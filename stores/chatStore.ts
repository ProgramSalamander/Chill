
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message, MessageRole, AISession } from '../types';
import { aiService, errorService } from '../services';
import { ragService } from '../services/ragService';
import { getFilePath } from '../utils/fileUtils';
import { useFileTreeStore } from './fileStore';
import { getActiveChatConfig, getAIConfig } from '../services/configService';
import { useUsageStore } from './usageStore';

interface ChatState {
  messages: Message[];
  isGenerating: boolean;
  isStopping: boolean;
  contextScope: 'project' | 'file';
  chatSession: AISession | null;
  activeChatProfileId: string | null;
  
  // Actions
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

      initChat: () => {
        const state = get();
        let { activeChatProfileId, chatSession } = state;
        const { messages } = state;
    
        if (!activeChatProfileId) {
          const activeConfig = getActiveChatConfig();
          activeChatProfileId = activeConfig?.id || null;
        }
    
        const profile = getAIConfig().profiles.find(p => p.id === activeChatProfileId);
    
        if (!profile) {
          errorService.report('No active AI model configured. Check your settings.', 'AI Chat Init', { severity: 'warning' });
          set({ chatSession: null, activeChatProfileId: null });
          return;
        }

        const isSwitching = activeChatProfileId !== state.activeChatProfileId || !chatSession;
    
        const history = messages.filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL);
        try {
          const session = aiService.createChatSession({
            systemInstruction: SYSTEM_INSTRUCTION,
            history,
            config: profile
          });
          set({ chatSession: session, activeChatProfileId: profile.id });

          if (isSwitching && messages.length === 0) {
            errorService.report(`AI connected [${profile.name}]`, 'AI Chat', { notifyUser: false, terminal: true, severity: 'info' });
          }
        } catch (e: any) {
          errorService.report(e, "AI Chat Session Creation");
        }
      },

      setActiveChatProfile: (profileId: string) => {
        const { activeChatProfileId } = get();
        if (profileId === activeChatProfileId) return;
      
        set({ messages: [], activeChatProfileId: profileId, chatSession: null });
        get().initChat();
      },

      stopGeneration: () => {
        set({ isStopping: true });
      },

      sendMessage: async (text, contextFileIds) => {
        let { chatSession, activeChatProfileId } = get();
        if (!chatSession) {
          get().initChat();
          chatSession = get().chatSession;
          if (!chatSession) {
            set({ isGenerating: false });
            return;
          }
        }
        
        const profile = getAIConfig().profiles.find(p => p.id === activeChatProfileId);
        if (!profile) return;

        const userMsg: Message = { id: Date.now().toString(), role: MessageRole.USER, text, timestamp: Date.now() };
        set(state => ({ messages: [...state.messages, userMsg], isGenerating: true, isStopping: false }));

        try {
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
              const context = await ragService.getContext(text, activeFile, files);
              prompt = `[SMART CONTEXT]\n${context}\n\n[QUERY]\n${text}`;
          } else if (activeFile) {
              prompt = `[FILE: ${activeFile.name}]\n${activeFile.content}\n\n[QUERY]\n${text}`;
          }

          const stream = await chatSession.sendMessageStream({ message: prompt });
          const responseId = (Date.now() + 1).toString();
          set(state => ({ 
            messages: [...state.messages, { 
              id: responseId, 
              role: MessageRole.MODEL, 
              text: '', 
              timestamp: Date.now(), 
              isStreaming: true,
              modelName: profile.name
            }] 
          }));
          
          let fullText = '';
          let lastUsage = undefined;

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
            if (chunk.usage) lastUsage = chunk.usage;
          }

          if (lastUsage) {
              useUsageStore.getState().recordUsage(profile.modelId, profile.provider, lastUsage, 'chat');
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
            errorService.report(error, "AI Chat Send Message");
        } finally { 
          set({ isGenerating: false, isStopping: false });
        }
      },

      setMessages: (messages) => set({ messages }),
      clearChat: () => {
        set({ messages: [] });
        get().initChat();
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
