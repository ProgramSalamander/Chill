
import React, { useState, useRef, useEffect } from 'react';
import { Message, MessageRole, File } from '../types';
import { IconSparkles, IconCpu, IconZap, IconClose, IconCopy, IconCheck, IconInsert, IconSearch, IconFolderOpen, IconFileCode } from './Icons';
import { GenerateContentResponse } from "@google/genai";

interface AIPanelProps {
  isOpen: boolean;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  activeFile: File | null;
  onClose: () => void;
  onApplyCode: (code: string) => void;
  onInsertCode: (code: string) => void;
  contextScope: 'project' | 'file';
  setContextScope: (scope: 'project' | 'file') => void;
}

const CodeBlock: React.FC<{ code: string; language: string; onApply: (c: string) => void; onInsert: (c: string) => void }> = ({ 
  code, 
  language, 
  onApply,
  onInsert
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-white/10 bg-black/30">
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5 text-xs text-slate-400">
            <span className="font-mono text-vibe-glow/80 opacity-70">{language || 'text'}</span>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={handleCopy} 
                  className="flex items-center justify-center p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy to Clipboard"
                >
                    {copied ? <IconCheck size={14} className="text-green-400" /> : <IconCopy size={14} />}
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                <button 
                  onClick={() => onInsert(code)}
                  className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-white/10 rounded transition-colors text-slate-300 hover:text-white"
                  title="Insert at Cursor"
                >
                    <IconInsert size={14} />
                    <span>Insert</span>
                </button>
                <button 
                  onClick={() => onApply(code)}
                  className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-indigo-500/20 rounded transition-colors text-indigo-400 hover:text-indigo-300"
                  title="Replace Entire File Content"
                >
                  <IconZap size={14} />
                  <span>Replace</span>
                </button>
            </div>
        </div>
        <pre className="p-3 overflow-x-auto text-xs font-mono text-slate-300 custom-scrollbar">
            <code>{code}</code>
        </pre>
    </div>
  );
};

const AIPanel: React.FC<AIPanelProps> = ({ 
  isOpen, 
  messages, 
  onSendMessage, 
  isGenerating, 
  activeFile,
  onClose,
  onApplyCode,
  onInsertCode,
  contextScope,
  setContextScope
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to detect code blocks in markdown
  const renderMessageContent = (text: string, role: MessageRole) => {
    if (role === MessageRole.USER) {
      return <p className="whitespace-pre-wrap">{text}</p>;
    }

    // Split by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return (
      <div className="space-y-2">
        {parts.map((part, idx) => {
          if (part.startsWith('```')) {
            const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
            const code = match ? match[2] : part.slice(3, -3);
            const lang = match ? match[1] : '';
            return (
              <CodeBlock 
                key={idx} 
                code={code} 
                language={lang} 
                onApply={onApplyCode} 
                onInsert={onInsertCode}
              />
            );
          }
          return <p key={idx} className="whitespace-pre-wrap">{part}</p>;
        })}
      </div>
    );
  };

  return (
    <div 
      className={`
        w-96 flex flex-col border-l border-white/10 glass-panel h-full absolute right-0 top-0 z-20 shadow-2xl 
        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform
        ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
      `}
    >
      {/* Header */}
      <div className="flex flex-col border-b border-white/10 bg-gradient-to-r from-vibe-800 to-vibe-900">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2 text-vibe-glow">
              <IconSparkles size={18} className="animate-pulse-slow" />
              <span className="font-semibold tracking-wide">Gemini Vibe</span>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <IconClose size={18} />
            </button>
          </div>

          {/* Context Scope Toggle */}
          <div className="px-4 pb-3 pt-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Context Scope</span>
              <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5">
                  <button 
                    onClick={() => setContextScope('file')}
                    className={`
                      flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all
                      ${contextScope === 'file' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    <IconFileCode size={12} />
                    File
                  </button>
                  <button 
                    onClick={() => setContextScope('project')}
                    className={`
                      flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all
                      ${contextScope === 'project' ? 'bg-vibe-accent/20 text-vibe-glow shadow-sm border border-vibe-accent/10' : 'text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    <IconFolderOpen size={12} />
                    Project
                  </button>
              </div>
          </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 opacity-50">
            <div className="relative">
                <IconSparkles size={48} className="text-vibe-glow opacity-50" />
                <div className="absolute -bottom-1 -right-1 bg-vibe-900 rounded-full p-1 border border-white/10">
                   {contextScope === 'project' ? <IconFolderOpen size={16} /> : <IconFileCode size={16} />}
                </div>
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-slate-300">
                    {contextScope === 'project' ? 'Full Project Context Active' : 'Active File Context Only'}
                </p>
                <p className="text-xs mt-1 max-w-[200px]">
                    {contextScope === 'project' 
                        ? 'I can see all your files and help with project-wide tasks.' 
                        : 'I am focused on the currently open file.'}
                </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm shadow-md ${
                msg.role === MessageRole.USER 
                  ? 'bg-vibe-accent text-white rounded-br-none' 
                  : 'bg-white/5 text-slate-200 border border-white/10 rounded-bl-none w-full'
              }`}
            >
              {renderMessageContent(msg.text, msg.role)}
            </div>
            <span className="text-[10px] text-slate-600 mt-1 px-1">
               {msg.role === 'user' ? 'You' : 'Gemini 2.5'} • {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            </span>
          </div>
        ))}
        {isGenerating && (
          <div className="flex items-center gap-2 text-slate-400 text-xs px-2 animate-pulse">
            <div className="w-2 h-2 bg-vibe-glow rounded-full"></div>
            Analyzing project structure & thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-vibe-900 border-t border-white/10">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contextScope === 'project' ? "Ask about any file in your project..." : "Ask about the current file..."}
            className="w-full bg-vibe-800/50 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-vibe-glow/50 focus:ring-1 focus:ring-vibe-glow/20 transition-all resize-none h-24"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="absolute right-3 bottom-3 p-2 bg-vibe-accent hover:bg-indigo-400 disabled:bg-slate-700 rounded-lg text-white transition-all shadow-lg shadow-indigo-500/20"
          >
            <IconZap size={16} fill={input.trim() ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIPanel;
