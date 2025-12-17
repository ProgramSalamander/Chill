import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message, MessageRole, AISession } from '../types';
import type { AIService } from '../services/aiService';
import type { RAGService } from '../services/ragService';
import { getFilePath } from '../utils/fileUtils';
import { useFileTreeStore } from './fileStore';
import { useTerminalStore } from './terminalStore';
import { getActiveChatConfig, getAIConfig } from '../services/configService';

interface ChatState {
  messages: Message[];
  isGenerating: boolean;
  isStopping: boolean;
  contextScope: 'project' | 'file';
  chatSession: AISession | null;
  activeChatProfileId: string | null;
  _aiService: AIService | null;
  _ragService: RAGService | null;
  
  // Actions
  setDependencies: (services: { aiService: AIService; ragService: RAGService }) => void;
  initChat: () => void;
  sendMessage: (text: string, contextFileIds?: string[]) => Promise<void>;
  stopGeneration: () => void;
  setMessages: (messages: Message[]) => void;
  clearChat: () => void;
  setContextScope: (scope: 'project' | 'file') => void;
  setActiveChatProfile: (profileId: string) => void;
}

const SYSTEM_INSTRUCTION = `You are VibeCode AI, an expert coding assistant integrated into a futuristic IDE. 
Your goal is to help the user write clean, modern, and efficient code.
When providing code, wrap it in markdown code blocks with the language specified.
Be concise, helpful, and "vibey" - professional but modern and slightly enthusiastic.
If the user asks to modify the current file, provide the full updated code block so they can apply it.
You have access to the project structure and contents when the user enables full context. Use this to understand dependencies and imports.`;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isGenerating: false,
      isStopping: false,
      contextScope: 'project',
      chatSession: null,
      activeChatProfileId: null,
      _aiService: null,
      _ragService: null,

      setDependencies: (services) => set({ _aiService: services.aiService, _ragService: services.ragService }),

      initChat: () => {
        let { activeChatProfileId, _aiService } = get();
        const { messages } = get();

        if (!_aiService) {
          console.warn("AI Service not initialized in chat store. Cannot init chat.");
          return;
        }
    
        if (!activeChatProfileId) {
          const activeConfig = getActiveChatConfig();
          activeChatProfileId = activeConfig?.id || null;
        }
    
        const profile = getAIConfig().profiles.find(p => p.id === activeChatProfileId);
    
        if (!profile) {
          useTerminalStore.getState().addTerminalLine('No active AI model configured.', 'error');
          set({ chatSession: null, activeChatProfileId: null });
          return;
        }
    
        const history = messages.filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL);
        const session = _aiService.createChatSession({
          systemInstruction: SYSTEM_INSTRUCTION,
          history,
          config: profile
        });
        set({ chatSession: session, activeChatProfileId: profile.id });

        // Only log on first-time init or model switch
        if (messages.length === 0) {
            useTerminalStore.getState().addTerminalLine(`AI connected [${profile.name}]`, 'info');
        }
      },

      setActiveChatProfile: (profileId: string) => {
        const { activeChatProfileId } = get();
        if (profileId === activeChatProfileId) return;
      
        // Reset chat history and set new profile, then re-initialize
        set({ messages: [], activeChatProfileId: profileId, chatSession: null });
        get().initChat();
      },

      stopGeneration: () => {
        set({ isStopping: true });
      },

      sendMessage: async (text, contextFileIds) => {
        let { chatSession, _ragService } = get();
        if (!chatSession) {
          get().initChat();
          chatSession = get().chatSession;
          if (!chatSession) {
            useTerminalStore.getState().addTerminalLine('AI is not configured. Please check settings.', 'error');
            set({ isGenerating: false });
            return;
          }
        }
        
        const userMsg: Message = { id: Date.now().toString(), role: MessageRole.USER, text, timestamp: Date.now() };
        set(state => ({ messages: [...state.messages, userMsg], isGenerating: true, isStopping: false }));

        try {
          // FIX: The `activeFile` property does not exist on the file store state. It must be derived from `files` and `activeFileId`.
          const { files, activeFileId } = useFileTreeStore.getState();
          const activeFile = files.find(f => f.id === activeFileId) || null;
          const { contextScope } = get();
          let prompt = text;
          
          if (contextFileIds && contextFileIds.length > 0) {
              let contextContent = "";
              for (const fid of contextFileIds) {
                  const f = files.find(file => file.id === fid);
                  if (f) contextContent += `File: ${getFilePath(f, files)}\n\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`;
              }
              prompt = `[EXPLICIT CONTEXT]\n${contextContent}\n[QUERY]\n${text}`;
          } else if (contextScope === 'project') {
              if (!_ragService) throw new Error("RAG service not available.");
              const context = _ragService.getContext(text, activeFile, files);
              prompt = `[SMART CONTEXT]\n${context}\n\n[QUERY]\n${text}`;
          } else if (activeFile) {
              prompt = `[FILE: ${activeFile.name}]\n${activeFile.content}\n\n[QUERY]\n${text}`;
          }

          const stream = await chatSession.sendMessageStream({ message: prompt });
          const responseId = (Date.now() + 1).toString();
          set(state => ({ messages: [...state.messages, { id: responseId, role: MessageRole.MODEL, text: '', timestamp: Date.now(), isStreaming: true }] }));
          
          let fullText = '';
          for await (const chunk of stream) {
            if (get().isStopping) {
              break;
            }
            if (chunk.text) {
                fullText += chunk.text;
                set(state => ({
                  messages: state.messages.map(m => m.id === responseId ? { ...m, text: fullText } : m)
                }));
            }
          }

          const wasStopped = get().isStopping;
          set(state => ({
            messages: state.messages.map(m => m.id === responseId ? { 
              ...m, 
              isStreaming: false,
              text: wasStopped ? m.text + ' [Stopped]' : m.text,
            } : m)
          }));

        } catch (error: any) { 
            useTerminalStore.getState().addTerminalLine(`AI Error: ${error.message}`, 'error'); 
            console.error(error);
        } finally { 
          set({ isGenerating: false, isStopping: false });
        }
      },

      setMessages: (messages) => set({ messages }),
      clearChat: () => {
        set({ messages: [] });
        get().initChat(); // Re-initialize chat session with empty history
      },
      setContextScope: (scope) => set({ contextScope: scope }),
    }),
    {
      name: 'vibe-chat-storage',
      partialize: (state) => ({ 
        messages: state.messages, 
        contextScope: state.contextScope,
        activeChatProfileId: state.activeChatProfileId
      }),
    }
  )
);