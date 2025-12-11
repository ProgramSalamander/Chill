
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message, MessageRole, File, AgentStep } from '../types';
import { 
  IconSparkles, IconCpu, IconZap, IconClose, IconCopy, IconCheck, 
  IconInsert, IconWand, IconTerminal, IconBug, IconPlus, IconFileCode, IconX 
} from './Icons';
import { useAgent } from '../hooks/useAgent';

interface AIPanelProps {
  isOpen: boolean;
  messages: Message[];
  onSendMessage: (text: string, contextFileIds?: string[]) => void;
  isGenerating: boolean;
  activeFile: File | null;
  onClose: () => void;
  onApplyCode: (code: string) => void;
  onInsertCode: (code: string) => void;
  contextScope: 'project' | 'file';
  setContextScope: (scope: 'project' | 'file') => void;
  files: File[];
  onAgentAction: (action: string, args: any) => Promise<string>;
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
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-lg">
        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 text-xs text-slate-400">
            <span className="font-mono text-vibe-glow font-bold opacity-80">{language || 'text'}</span>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={handleCopy} 
                  className="flex items-center justify-center p-1.5 hover:bg-white/10 rounded-md transition-colors"
                  title="Copy to Clipboard"
                >
                    {copied ? <IconCheck size={14} className="text-green-400" /> : <IconCopy size={14} />}
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-1" />
                <button 
                  onClick={() => onInsert(code)}
                  className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md transition-colors text-slate-300 hover:text-white"
                  title="Insert at Cursor"
                >
                    <IconInsert size={14} />
                    <span>Insert</span>
                </button>
                <button 
                  onClick={() => onApply(code)}
                  className="flex items-center gap-1 px-2 py-1 hover:bg-vibe-accent/20 rounded-md transition-colors text-vibe-accent hover:text-indigo-300"
                  title="Replace Entire File Content"
                >
                  <IconZap size={14} />
                  <span>Apply</span>
                </button>
            </div>
        </div>
        <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-200 custom-scrollbar leading-relaxed">
            <code>{code}</code>
        </pre>
    </div>
  );
};

// Rich Text Parser
const RichText: React.FC<{ text: string }> = ({ text }) => {
    // Basic markdown parsing for bold, italic, inline code, and lists
    const parse = (input: string) => {
        const parts = [];
        let lastIndex = 0;
        // Regex for **bold**, *italic*, `code`, and list items
        const regex = /(\*\*.*?\*\*)|(`.*?`)|(^\s*-\s.*$)|(\*.*?\*)/gm;
        let match;

        while ((match = regex.exec(input)) !== null) {
            if (match.index > lastIndex) {
                parts.push(input.substring(lastIndex, match.index));
            }
            const fullMatch = match[0];
            if (fullMatch.startsWith('**')) {
                parts.push(<strong key={match.index} className="text-white font-bold">{fullMatch.slice(2, -2)}</strong>);
            } else if (fullMatch.startsWith('`')) {
                parts.push(<code key={match.index} className="bg-white/10 px-1 py-0.5 rounded text-vibe-glow font-mono text-[90%]">{fullMatch.slice(1, -1)}</code>);
            } else if (fullMatch.startsWith('*')) {
                parts.push(<em key={match.index} className="italic text-slate-300">{fullMatch.slice(1, -1)}</em>);
            } else if (fullMatch.trim().startsWith('-')) {
                 parts.push(<div key={match.index} className="flex gap-2 ml-2 my-1"><span className="text-vibe-accent">•</span><span>{fullMatch.replace(/^\s*-\s/, '')}</span></div>);
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < input.length) {
            parts.push(input.substring(lastIndex));
        }
        return parts;
    };

    // Split by newlines to handle block level elements like lists better
    const lines = text.split('\n');
    return (
        <div className="whitespace-pre-wrap leading-relaxed text-slate-300">
             {lines.map((line, i) => (
                 <React.Fragment key={i}>
                     {parse(line)}
                     {i < lines.length - 1 && '\n'}
                 </React.Fragment>
             ))}
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
  setContextScope,
  files,
  onAgentAction
}) => {
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [input, setInput] = useState('');
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([]);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Use extracted agent hook
  const { agentSteps, isAgentRunning, runAgent } = useAgent(onAgentAction);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, agentSteps, isOpen, mode]);

  // Handle click outside picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowContextPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-pin active file when switching scopes logic if needed, 
  // but we prefer manual pinning for the "World Class" feel.

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (mode === 'chat') {
        if (isGenerating) return;
        // Pass pinned files + active file if scope is 'file'
        let contextIds = [...pinnedFiles];
        if (contextScope === 'file' && activeFile && !contextIds.includes(activeFile.id)) {
            contextIds.push(activeFile.id);
        } else if (contextScope === 'project') {
             // For project scope, we might send all or rely on RAG. 
             // Sending specific IDs hints to the hook to prioritize them.
        }
        
        onSendMessage(input, contextIds.length > 0 ? contextIds : undefined);
        setInput('');
        setPinnedFiles([]); // Optional: clear pins after send? Maybe keep them. Let's keep them for flow.
    } else {
        if (isAgentRunning) return;
        runAgent(input);
        setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const togglePin = (fileId: string) => {
      setPinnedFiles(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);
  };

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

  const renderAgentStep = (step: AgentStep, index: number, total: number) => {
      const isLast = index === total - 1;
      
      return (
          <div className="relative pl-6 pb-6 border-l border-white/10 last:border-0 last:pb-0">
              <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f0f16] ${
                  step.type === 'error' ? 'bg-red-500' :
                  step.type === 'result' ? 'bg-green-500' :
                  step.type === 'call' ? 'bg-yellow-500' :
                  step.type === 'user' ? 'bg-vibe-accent' :
                  'bg-slate-600'
              }`}></div>
              
              {step.type === 'user' && (
                  <div className="bg-vibe-accent/10 border border-vibe-accent/20 rounded-lg p-3 text-white text-sm">
                      <div className="text-[10px] text-vibe-glow font-bold uppercase mb-1 flex items-center gap-2">
                          <IconSparkles size={10} /> Goal
                      </div>
                      {step.text}
                  </div>
              )}
              
              {step.type === 'thought' && (
                  <div className="text-slate-400 text-xs italic bg-white/5 p-2 rounded border border-white/5">
                      "{step.text}"
                  </div>
              )}
              
              {step.type === 'call' && (
                  <div className="flex flex-col gap-1 text-xs">
                       <span className="text-yellow-400 font-mono font-bold flex items-center gap-1">
                           <IconWand size={10} /> 
                           Executing: {step.toolName}
                       </span>
                       <div className="bg-black/40 border border-white/10 rounded p-2 font-mono text-slate-400 overflow-x-auto">
                           {JSON.stringify(step.toolArgs)}
                       </div>
                  </div>
              )}
              
              {step.type === 'result' && (
                  <div className="flex flex-col gap-1 text-xs">
                       <span className="text-green-400 font-mono font-bold flex items-center gap-1">
                           <IconCheck size={10} /> 
                           Result
                       </span>
                       <div className="bg-green-900/10 border border-green-500/10 rounded p-2 font-mono text-slate-300 opacity-80 max-h-32 overflow-y-auto custom-scrollbar">
                           {step.text}
                       </div>
                  </div>
              )}
              
              {step.type === 'error' && (
                  <div className="text-red-400 text-xs bg-red-400/10 p-2 rounded border border-red-400/20 flex items-center gap-2">
                      <IconClose size={14} />
                      {step.text}
                  </div>
              )}
              
              {step.type === 'response' && (
                   <div className="text-vibe-glow text-sm font-medium py-2 flex items-center gap-2 animate-in slide-in-from-left-2">
                       <IconSparkles size={16} />
                       {step.text}
                   </div>
               )}
          </div>
      );
  };

  return (
    <div 
      className={`
        w-[450px] flex flex-col glass-panel absolute right-4 top-4 bottom-4 z-50 rounded-2xl shadow-2xl 
        transition-all duration-500 cubic-bezier(0.19, 1, 0.22, 1) transform border border-white/10 overflow-hidden
        ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[110%] opacity-0 pointer-events-none'}
      `}
    >
      {/* Background Noise Texture */}
      <div className="absolute inset-0 z-[-1] opacity-5 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat opacity-20 mix-blend-overlay"></div>
      
      {/* Header */}
      <div className="flex flex-col border-b border-white/5 bg-white/5 backdrop-blur-md z-10">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                  {isAgentRunning ? (
                    <div className="relative">
                       <div className="absolute inset-0 bg-orange-500 blur-lg opacity-40 animate-pulse"></div>
                       <IconCpu size={24} className="text-orange-400 relative z-10 animate-spin-slow" />
                    </div>
                  ) : (
                    <div className="relative">
                       <div className="absolute inset-0 bg-vibe-accent blur-lg opacity-40 animate-pulse"></div>
                       <IconSparkles size={24} className="text-vibe-glow relative z-10" />
                    </div>
                  )}
              </div>
              <div>
                  <h3 className="font-bold tracking-wide text-white text-sm flex items-center gap-2">
                      {mode === 'chat' ? 'Vibe Chat' : 'Vibe Agent'}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/5 text-slate-400 font-mono">v3.0</span>
                  </h3>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
              <IconClose size={18} />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
              <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full backdrop-blur-sm">
                  <button 
                    onClick={() => setMode('chat')}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                      ${mode === 'chat' ? 'bg-vibe-accent/20 text-white shadow-sm border border-vibe-accent/30' : 'text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    <IconSparkles size={12} />
                    Chat
                  </button>
                  <button 
                    onClick={() => setMode('agent')}
                    className={`
                       flex-1 flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                      ${mode === 'agent' ? 'bg-orange-500/20 text-orange-300 shadow-sm border border-orange-500/30' : 'text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    <IconBug size={12} />
                    Agent
                  </button>
              </div>
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/30">
        
        {/* Chat Mode View */}
        {mode === 'chat' && (
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
                    {msg.role === 'user' ? 'You' : 'Vibe AI'} • {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
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
        )}

        {/* Agent Mode View - Timeline */}
        {mode === 'agent' && (
            <div className="px-2 pt-2">
                 {agentSteps.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-slate-500 space-y-4 opacity-60">
                        <IconTerminal size={32} className="text-orange-400" />
                        <div className="text-center">
                            <p className="text-sm font-semibold text-white">Autonomous Agent</p>
                            <p className="text-xs mt-2 max-w-[250px]">Give me a goal. I will explore, plan, and edit files to complete it.</p>
                        </div>
                    </div>
                 )}
                 <div className="flex flex-col">
                     {agentSteps.map((step, idx) => renderAgentStep(step, idx, agentSteps.length))}
                 </div>
                 {isAgentRunning && (
                    <div className="flex items-center gap-2 text-orange-400 text-xs px-8 pt-4 border-l border-white/10 ml-2">
                        <div className="w-2 h-2 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-mono">Agent is working...</span>
                    </div>
                 )}
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/5 border-t border-white/5 backdrop-blur-md z-20">
        
        {/* Pinned Context Chips */}
        {pinnedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 animate-in slide-in-from-bottom-1">
                {pinnedFiles.map(fid => {
                    const f = files.find(file => file.id === fid);
                    if (!f) return null;
                    return (
                        <div key={fid} className="flex items-center gap-1 bg-vibe-accent/20 border border-vibe-accent/30 text-vibe-glow text-[10px] px-2 py-0.5 rounded-full">
                            <IconFileCode size={10} />
                            <span>{f.name}</span>
                            <button onClick={() => togglePin(fid)} className="hover:text-white"><IconX size={10} /></button>
                        </div>
                    );
                })}
            </div>
        )}

        <div className="relative group">
          <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 blur ${mode === 'agent' ? 'from-orange-500 to-red-500' : 'from-vibe-accent to-purple-600'}`}></div>
          <div className="relative flex items-end gap-2 bg-[#0a0a0f]/90 border border-white/10 rounded-xl p-2 shadow-inner">
             
             {/* Context Picker Button */}
             <div className="relative" ref={pickerRef}>
                <button 
                    onClick={() => setShowContextPicker(!showContextPicker)}
                    className={`p-2 rounded-lg transition-colors ${pinnedFiles.length > 0 || showContextPicker ? 'text-vibe-glow bg-vibe-accent/10' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
                    title="Pin Context Files"
                >
                    <IconPlus size={18} />
                </button>
                
                {/* Context Picker Popover */}
                {showContextPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 max-h-60 bg-[#0f0f16] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
                        <div className="p-2 border-b border-white/10 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Select Files to Pin
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-1">
                            {files.map(f => (
                                <button 
                                    key={f.id}
                                    onClick={() => togglePin(f.id)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left ${pinnedFiles.includes(f.id) ? 'bg-vibe-accent/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                                >
                                    <span className={pinnedFiles.includes(f.id) ? 'text-vibe-glow' : 'opacity-50'}>
                                        {f.type === 'folder' ? <IconClose className="rotate-45" size={12}/> : <IconFileCode size={14} />}
                                    </span>
                                    <span className="truncate">{f.name}</span>
                                    {pinnedFiles.includes(f.id) && <IconCheck size={12} className="ml-auto text-vibe-glow" />}
                                </button>
                            ))}
                            {files.length === 0 && <div className="p-2 text-center text-xs text-slate-600">No files</div>}
                        </div>
                    </div>
                )}
             </div>

            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'agent' ? "Describe a task for the agent..." : "Ask Vibe AI..."}
                className="w-full bg-transparent border-none text-sm text-white focus:outline-none placeholder-slate-600 resize-none py-2 max-h-32 min-h-[40px] custom-scrollbar"
                style={{ height: Math.min(input.split('\n').length * 20 + 20, 120) + 'px' }}
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() || isGenerating || isAgentRunning}
                className={`p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-xl disabled:bg-slate-800 disabled:text-slate-600 ${mode === 'agent' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/30' : 'bg-vibe-accent hover:bg-indigo-400 shadow-indigo-500/30'}`}
            >
                <IconZap size={18} fill={input.trim() ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
        {mode === 'chat' && (
             <div className="mt-2 flex justify-between items-center px-1">
                  <div className="flex gap-2 text-[9px] text-slate-500 font-mono uppercase tracking-wide">
                      <button onClick={() => setContextScope('file')} className={`hover:text-white transition-colors flex items-center gap-1 ${contextScope === 'file' ? 'text-vibe-glow' : ''}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${contextScope === 'file' ? 'bg-vibe-glow' : 'bg-slate-700'}`}></div>
                          Current File
                      </button>
                      <span className="opacity-30">|</span>
                      <button onClick={() => setContextScope('project')} className={`hover:text-white transition-colors flex items-center gap-1 ${contextScope === 'project' ? 'text-vibe-glow' : ''}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${contextScope === 'project' ? 'bg-vibe-glow' : 'bg-slate-700'}`}></div>
                          Full Project
                      </button>
                  </div>
                  <span className="text-[9px] text-slate-600">Markdown Supported</span>
             </div>
        )}
      </div>
    </div>
  );
};

export default AIPanel;
