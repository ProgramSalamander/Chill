import React, { useState, useRef, useEffect } from 'react';
import { Message, MessageRole, File, AgentStep, AISession, AIToolCall } from '../types';
import { IconSparkles, IconCpu, IconZap, IconClose, IconCopy, IconCheck, IconInsert, IconWand, IconTerminal, IconBug } from './Icons';
import { createChatSession } from '../services/geminiService';

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
                  <span>Replace</span>
                </button>
            </div>
        </div>
        <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-200 custom-scrollbar leading-relaxed">
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
  setContextScope,
  files,
  onAgentAction
}) => {
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Agent State
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const agentChatRef = useRef<AISession | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, agentSteps, isOpen, mode]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (mode === 'chat') {
        if (isGenerating) return;
        onSendMessage(input);
        setInput('');
    } else {
        if (isAgentRunning) return;
        handleRunAgent(input);
        setInput('');
    }
  };

  const handleRunAgent = async (goal: string) => {
      setIsAgentRunning(true);
      setAgentSteps(prev => [...prev, {
          id: Date.now().toString(),
          type: 'user',
          text: goal,
          timestamp: Date.now()
      }]);

      try {
          const systemPrompt = `You are an autonomous coding agent called "Vibe Agent".
          Your goal is to complete the user's request by autonomously exploring the codebase, reading files, and writing code.
          
          Guidelines:
          1. Start by exploring the codebase using 'listFiles' to understand the structure.
          2. Read relevant files using 'readFile'.
          3. Plan your changes.
          4. Execute changes using 'writeFile'.
          5. Verify your work (conceptually).
          
          Always keep the user informed of what you are doing. If you need to "think", just output text.
          If you need to perform an action, use the available tools.
          `;
          
          const chat = createChatSession(systemPrompt, [], true);
          agentChatRef.current = chat;
          
          let currentInput = goal;
          let keepGoing = true;
          let turns = 0;
          const MAX_TURNS = 15;

          while (keepGoing && turns < MAX_TURNS) {
              turns++;
              
              let response = await chat.sendMessage({ message: currentInput });
              currentInput = "";

              if (response.text) {
                  setAgentSteps(prev => [...prev, {
                      id: Math.random().toString(),
                      type: 'thought',
                      text: response.text,
                      timestamp: Date.now()
                  }]);
              }

              const calls = response.toolCalls;
              
              if (calls && calls.length > 0) {
                  const toolResponses: any[] = [];
                  
                  for (const call of calls) {
                      setAgentSteps(prev => [...prev, {
                          id: Math.random().toString(),
                          type: 'call',
                          text: `Running ${call.name}...`,
                          toolName: call.name,
                          toolArgs: call.args,
                          timestamp: Date.now()
                      }]);

                      let result = "Error";
                      try {
                          result = await onAgentAction(call.name, call.args);
                      } catch (e: any) {
                          result = `Error executing ${call.name}: ${e.message}`;
                      }
                      
                      setAgentSteps(prev => [...prev, {
                        id: Math.random().toString(),
                        type: 'result',
                        text: result.length > 200 ? result.slice(0, 200) + '...' : result,
                        timestamp: Date.now()
                      }]);

                      toolResponses.push({
                          id: call.id, 
                          name: call.name,
                          result: result
                      });
                  }

                  response = await chat.sendMessage({ message: "", toolResponses: toolResponses });
                  
                  if (response.text) {
                      setAgentSteps(prev => [...prev, {
                          id: Math.random().toString(),
                          type: 'thought',
                          text: response.text,
                          timestamp: Date.now()
                      }]);
                  }
                  
                  if (!response.toolCalls || response.toolCalls.length === 0) {
                      keepGoing = false;
                      setAgentSteps(prev => [...prev, {
                        id: Math.random().toString(),
                        type: 'response',
                        text: "Task completed.",
                        timestamp: Date.now()
                      }]);
                  } else {
                       if (response.toolCalls && response.toolCalls.length > 0) {
                           let activeResponse = response;
                           while (activeResponse.toolCalls && activeResponse.toolCalls.length > 0 && turns < MAX_TURNS) {
                               turns++;
                               const nextResponses: any[] = [];
                               for (const call of activeResponse.toolCalls) {
                                   setAgentSteps(prev => [...prev, { id: Math.random().toString(), type: 'call', text: `Running ${call.name}...`, toolName: call.name, toolArgs: call.args, timestamp: Date.now() }]);
                                   const res = await onAgentAction(call.name, call.args);
                                   setAgentSteps(prev => [...prev, { id: Math.random().toString(), type: 'result', text: res.length > 100 ? res.slice(0,100)+'...' : res, timestamp: Date.now() }]);
                                   nextResponses.push({ id: call.id, name: call.name, result: res });
                               }
                               activeResponse = await chat.sendMessage({ message: "", toolResponses: nextResponses });
                               if (activeResponse.text) {
                                   setAgentSteps(prev => [...prev, { id: Math.random().toString(), type: 'thought', text: activeResponse.text, timestamp: Date.now() }]);
                               }
                           }
                           keepGoing = false;
                       } else {
                           keepGoing = false;
                       }
                  }
              } else {
                  keepGoing = false;
                  setAgentSteps(prev => [...prev, {
                      id: Math.random().toString(),
                      type: 'response',
                      text: "Done.",
                      timestamp: Date.now()
                  }]);
              }
          }

      } catch (e: any) {
          console.error(e);
          setAgentSteps(prev => [...prev, {
              id: Date.now().toString(),
              type: 'error',
              text: `Error: ${e.message}`,
              timestamp: Date.now()
          }]);
      } finally {
          setIsAgentRunning(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (text: string, role: MessageRole) => {
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
          return <p key={idx} className="whitespace-pre-wrap leading-relaxed text-slate-300">{part}</p>;
        })}
      </div>
    );
  };

  const renderAgentStep = (step: AgentStep) => {
      switch(step.type) {
          case 'user':
              return (
                  <div className="bg-vibe-accent/20 border border-vibe-accent/30 rounded-lg p-3 text-white text-sm">
                      <div className="text-[10px] text-vibe-glow font-bold uppercase mb-1">Goal</div>
                      {step.text}
                  </div>
              );
          case 'thought':
              return (
                  <div className="pl-3 border-l-2 border-slate-700 text-slate-300 text-sm py-1">
                      {step.text}
                  </div>
              );
          case 'call':
              return (
                  <div className="flex items-center gap-2 text-yellow-400/80 text-xs font-mono py-1 px-3 bg-yellow-400/5 rounded border border-yellow-400/10">
                      <IconWand size={12} />
                      <span className="font-bold">{step.toolName}</span>
                      <span className="opacity-50 truncate max-w-[200px]">{JSON.stringify(step.toolArgs)}</span>
                  </div>
              );
          case 'result':
              return (
                  <div className="flex items-center gap-2 text-green-400/80 text-xs font-mono py-1 px-3 bg-green-400/5 rounded border border-green-400/10">
                      <IconCheck size={12} />
                      <span className="truncate opacity-70">Result received</span>
                  </div>
              );
          case 'error':
               return (
                  <div className="text-red-400 text-xs bg-red-400/10 p-2 rounded border border-red-400/20">
                      {step.text}
                  </div>
               );
          case 'response':
               return (
                   <div className="text-vibe-glow text-sm font-medium py-2 flex items-center gap-2">
                       <IconCheck size={16} />
                       {step.text}
                   </div>
               );
          default:
              return null;
      }
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
      <div className="flex flex-col border-b border-white/5 bg-white/5 backdrop-blur-md">
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
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/5 text-slate-400 font-mono">v2.5</span>
                  </h3>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
              <IconClose size={18} />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="px-4 pb-4 pt-1 flex items-center justify-between">
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
                            {contextScope === 'project' 
                                ? 'I have full visibility of your project structure. Ask me anything.' 
                                : 'I am focused on the active file context.'}
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
                        : 'bg-[#181824]/60 text-slate-200 rounded-bl-sm border-white/5'
                    }`}
                    >
                    {renderMessageContent(msg.text, msg.role)}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1.5 px-1 font-mono opacity-70">
                    {msg.role === 'user' ? 'You' : 'Vibe AI'} • {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </span>
                </div>
                ))}
                {isGenerating && (
                <div className="flex items-center gap-3 text-vibe-glow text-xs px-2 animate-pulse">
                    <div className="w-2 h-2 bg-vibe-glow rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-vibe-glow rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-vibe-glow rounded-full animate-bounce delay-150"></div>
                    <span className="font-mono ml-2 opacity-70">Thinking...</span>
                </div>
                )}
            </>
        )}

        {/* Agent Mode View */}
        {mode === 'agent' && (
            <div className="space-y-4">
                 {agentSteps.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-slate-500 space-y-4 opacity-60">
                        <IconTerminal size={32} className="text-orange-400" />
                        <div className="text-center">
                            <p className="text-sm font-semibold text-white">Autonomous Agent</p>
                            <p className="text-xs mt-2 max-w-[250px]">Give me a goal. I will explore, plan, and edit files to complete it.</p>
                        </div>
                    </div>
                 )}
                 {agentSteps.map(step => (
                     <div key={step.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                         {renderAgentStep(step)}
                     </div>
                 ))}
                 {isAgentRunning && (
                    <div className="flex items-center gap-2 text-orange-400 text-xs px-2 pt-2">
                        <div className="w-2 h-2 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-mono">Agent is working...</span>
                    </div>
                 )}
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white/5 border-t border-white/5 backdrop-blur-md">
        <div className="relative group">
          <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 blur ${mode === 'agent' ? 'from-orange-500 to-red-500' : 'from-vibe-accent to-purple-600'}`}></div>
          <div className="relative">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'agent' ? "Describe a complex task..." : (contextScope === 'project' ? "Ask Vibe AI about your project..." : "Ask about this file...")}
                className="w-full bg-[#0a0a0f]/80 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white focus:outline-none placeholder-slate-600 transition-all resize-none h-14 focus:h-24 shadow-inner"
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() || isGenerating || isAgentRunning}
                className={`absolute right-2 bottom-2 p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-xl disabled:bg-slate-800 disabled:text-slate-600 ${mode === 'agent' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/30' : 'bg-vibe-accent hover:bg-indigo-400 shadow-indigo-500/30'}`}
            >
                <IconZap size={18} fill={input.trim() ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
        {mode === 'chat' && (
             <div className="mt-2 flex justify-center">
                  <div className="flex gap-2 text-[9px] text-slate-500 font-mono uppercase tracking-wide">
                      <button onClick={() => setContextScope('file')} className={`hover:text-white transition-colors ${contextScope === 'file' ? 'text-vibe-glow' : ''}`}>Current File</button>
                      <span className="opacity-30">|</span>
                      <button onClick={() => setContextScope('project')} className={`hover:text-white transition-colors ${contextScope === 'project' ? 'text-vibe-glow' : ''}`}>Full Project</button>
                  </div>
             </div>
        )}
      </div>
    </div>
  );
};

export default AIPanel;