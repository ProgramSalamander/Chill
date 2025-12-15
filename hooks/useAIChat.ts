import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, MessageRole, File, AISession } from '../types';
// FIX: Replaced import from empty geminiService.ts with aiService.
import { aiService } from '../services/aiService';
import { ragService } from '../services/ragService';
import { getFilePath } from '../utils/fileUtils';

const SYSTEM_INSTRUCTION = `You are VibeCode AI, an expert coding assistant integrated into a futuristic IDE. 
Your goal is to help the user write clean, modern, and efficient code.
When providing code, wrap it in markdown code blocks with the language specified.
Be concise, helpful, and "vibey" - professional but modern and slightly enthusiastic.
If the user asks to modify the current file, provide the full updated code block so they can apply it.
You have access to the project structure and contents when the user enables full context. Use this to understand dependencies and imports.`;

export const useAIChat = (
  files: File[], 
  activeFile: File | null, 
  contextScope: 'project' | 'file',
  addTerminalLine: (text: string, type: 'info' | 'error' | 'success' | 'command' | 'warning') => void
) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('vibe_chat_history');
      return saved ? JSON.parse(saved).map((m: Message) => ({ ...m, isStreaming: false })) : [];
    } catch { return []; }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const chatSessionRef = useRef<AISession | null>(null);
  const messagesRef = useRef(messages);

  useEffect(() => { 
      messagesRef.current = messages; 
      localStorage.setItem('vibe_chat_history', JSON.stringify(messages));
  }, [messages]);

  const initChat = useCallback(() => {
      const history = messagesRef.current.filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL);
      // FIX: Call aiService.createChatSession with the correct object argument.
      chatSessionRef.current = aiService.createChatSession({ systemInstruction: SYSTEM_INSTRUCTION, history });
      addTerminalLine('System initialized. VibeCode AI connected.', 'info');
  }, [addTerminalLine]);

  const sendMessage = async (text: string, contextFileIds?: string[]) => {
    if (!chatSessionRef.current) return;
    const userMsg: Message = { id: Date.now().toString(), role: MessageRole.USER, text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    try {
      let prompt = text;
      
      // 1. Explicitly pinned files
      if (contextFileIds && contextFileIds.length > 0) {
          let contextContent = "";
          for (const fid of contextFileIds) {
              const f = files.find(file => file.id === fid);
              if (f) {
                  contextContent += `File: ${getFilePath(f, files)}\n\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`;
              }
          }
          prompt = `[EXPLICIT CONTEXT]\n${contextContent}\n[QUERY]\n${text}`;
      
      // 2. Project Scope (RAG)
      } else if (contextScope === 'project') {
          const context = ragService.getContext(text, activeFile, files);
          prompt = `[SMART CONTEXT]\n${context}\n\n[QUERY]\n${text}`;
      
      // 3. File Scope (Active File only)
      } else if (activeFile) {
          prompt = `[FILE: ${activeFile.name}]\n${activeFile.content}\n\n[QUERY]\n${text}`;
      }

      // FIX: Call aiService.sendMessageStream.
      const stream = await aiService.sendMessageStream(chatSessionRef.current, prompt);
      const responseId = (Date.now() + 1).toString();
      setMessages(p => [...p, { id: responseId, role: MessageRole.MODEL, text: '', timestamp: Date.now(), isStreaming: true }]);
      let fullText = '';
      for await (const chunk of stream) {
        if (chunk.text) {
            fullText += chunk.text;
            setMessages(p => p.map(m => m.id === responseId ? { ...m, text: fullText } : m));
        }
      }
      setMessages(p => p.map(m => m.id === responseId ? { ...m, isStreaming: false } : m));
    } catch (error: any) { 
        addTerminalLine('AI Error', 'error'); 
        console.error(error);
    } 
    finally { setIsGenerating(false); }
  };

  return { messages, isGenerating, sendMessage, initChat, setMessages };
};