import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message, MessageRole, AISession } from '../types';
import { aiService } from '../services/aiService';
import { ragService } from '../services/ragService';
import { getFilePath } from '../utils/fileUtils';
import { useFileTreeStore } from './fileStore';
import { useTerminalStore } from './terminalStore';

interface ChatState {
  messages: Message[];
  isGenerating: boolean;
  contextScope: 'project' | 'file';
  chatSession: AISession | null;
  
  // Actions
  initChat: () => void;
  sendMessage: (text: string, contextFileIds?: string[]) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  clearChat: () => void;
  setContextScope: (scope: 'project' | 'file') => void;
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
      contextScope: 'project',
      chatSession: null,

      initChat: () => {
        const history = get().messages.filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL);
        const session = aiService.createChatSession({ systemInstruction: SYSTEM_INSTRUCTION, history });
        set({ chatSession: session });
        useTerminalStore.getState().addTerminalLine('System initialized. VibeCode AI connected.', 'info');
      },

      sendMessage: async (text, contextFileIds) => {
        const { chatSession, contextScope } = get();
        if (!chatSession) return;
        
        const userMsg: Message = { id: Date.now().toString(), role: MessageRole.USER, text, timestamp: Date.now() };
        set(state => ({ messages: [...state.messages, userMsg], isGenerating: true }));

        try {
          const { files, activeFile } = useFileTreeStore.getState();
          let prompt = text;
          
          if (contextFileIds && contextFileIds.length > 0) {
              let contextContent = "";
              for (const fid of contextFileIds) {
                  const f = files.find(file => file.id === fid);
                  if (f) contextContent += `File: ${getFilePath(f, files)}\n\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`;
              }
              prompt = `[EXPLICIT CONTEXT]\n${contextContent}\n[QUERY]\n${text}`;
          } else if (contextScope === 'project') {
              const context = ragService.getContext(text, activeFile, files);
              prompt = `[SMART CONTEXT]\n${context}\n\n[QUERY]\n${text}`;
          } else if (activeFile) {
              prompt = `[FILE: ${activeFile.name}]\n${activeFile.content}\n\n[QUERY]\n${text}`;
          }

          const stream = await aiService.sendMessageStream(chatSession, prompt);
          const responseId = (Date.now() + 1).toString();
          set(state => ({ messages: [...state.messages, { id: responseId, role: MessageRole.MODEL, text: '', timestamp: Date.now(), isStreaming: true }] }));
          
          let fullText = '';
          for await (const chunk of stream) {
            if (chunk.text) {
                fullText += chunk.text;
                set(state => ({
                  messages: state.messages.map(m => m.id === responseId ? { ...m, text: fullText } : m)
                }));
            }
          }
          set(state => ({
            messages: state.messages.map(m => m.id === responseId ? { ...m, isStreaming: false } : m)
          }));
        } catch (error: any) { 
            useTerminalStore.getState().addTerminalLine('AI Error', 'error'); 
            console.error(error);
        } finally { 
          set({ isGenerating: false });
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
      partialize: (state) => ({ messages: state.messages, contextScope: state.contextScope }),
    }
  )
);
