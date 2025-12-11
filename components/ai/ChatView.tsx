import React from 'react';
import { Message, MessageRole } from '../../types';
import { IconSparkles } from '../Icons';
import CodeBlock from './CodeBlock';
import RichText from './RichText';

interface ChatViewProps {
  messages: Message[];
  isGenerating: boolean;
  onApplyCode: (code: string) => void;
  onInsertCode: (code: string) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ messages, isGenerating, onApplyCode, onInsertCode }) => {
  const renderMessageContent = (text: string, role: MessageRole, isStreaming?: boolean) => {
    if (role === MessageRole.USER) {
      return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
    }

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
          return <RichText key={idx} text={part} />;
        })}
        {isStreaming && (
             <span className="inline-block w-1.5 h-4 bg-vibe-accent ml-1 align-middle animate-pulse"></span>
        )}
      </div>
    );
  };

  return (
    <>
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-6 opacity-80">
          <div className="relative group cursor-pointer hover:scale-105 transition-transform duration-500">
            <div className="absolute inset-0 bg-vibe-accent blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
            <div className="relative bg-white/5 p-8 rounded-full border border-vibe-border shadow-2xl backdrop-blur-md">
              <IconSparkles size={48} className="text-vibe-glow" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold text-white">How can I help you code today?</p>
            <p className="text-xs max-w-[240px] mx-auto leading-relaxed text-slate-400">
              Use <span className="text-vibe-glow">@</span> to pin files to context.
            </p>
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
          <div
            className={`max-w-[95%] rounded-2xl px-5 py-3.5 text-sm shadow-xl backdrop-blur-md border ${
              msg.role === MessageRole.USER
                ? 'bg-vibe-accent/80 text-white rounded-br-sm border-indigo-400/30 shadow-[0_4px_15px_rgba(99,102,241,0.2)]'
                : 'bg-[#181824]/80 text-slate-200 rounded-bl-sm border-white/10'
            }`}
          >
            {renderMessageContent(msg.text, msg.role, msg.isStreaming)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1.5 px-1 font-mono opacity-70">
            {msg.role === 'user' ? 'You' : 'Vibe AI'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
      {isGenerating && messages[messages.length - 1]?.role === MessageRole.USER && (
        <div className="flex items-center gap-3 text-vibe-glow text-xs px-2 animate-pulse">
          <div className="w-2 h-2 bg-vibe-glow rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-vibe-glow rounded-full animate-bounce delay-75"></div>
          <div className="w-2 h-2 bg-vibe-glow rounded-full animate-bounce delay-150"></div>
          <span className="font-mono ml-2 opacity-70">Thinking...</span>
        </div>
      )}
    </>
  );
};

export default ChatView;
