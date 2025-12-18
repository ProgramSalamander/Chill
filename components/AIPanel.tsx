
import React, { useState, useRef, useEffect, useMemo } from 'react';
import AgentHUD from './ai/AgentHUD';
import ChatView from './ai/ChatView';
import AIPanelInput from './ai/AIPanelInput';
import Tooltip from './Tooltip';
import { IconSparkles, IconCpu, IconClose, IconTrash, IconChevronDown, IconMessage } from './Icons';

import { useChatStore } from '../stores/chatStore';
import { useFileTreeStore } from '../stores/fileStore';
import { useAgentStore } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';
import PlanNode from './ai/PlanNode';
import { getAIConfig } from '../services';
import { selectActiveFile, selectMessages, selectIsGenerating, selectIsAIOpen } from '../stores/selectors';

interface AIPanelProps {
  onInsertCode: (code: string) => void;
}

const ModelSwitcher: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { profiles, activeChatProfileId: globalActiveId } = getAIConfig();
    const activeId = useChatStore(state => state.activeChatProfileId);
    const setActiveProfile = useChatStore(state => state.setActiveChatProfile);

    const activeProfile = useMemo(() => profiles.find(p => p.id === activeId) || profiles.find(p => p.id === globalActiveId) || profiles[0], [profiles, activeId, globalActiveId]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!activeProfile) return <div className="text-[10px] text-red-400 font-mono mt-0.5">No Model Selected</div>;

    return (
        <div className="relative" ref={wrapperRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="text-[10px] text-slate-500 font-mono mt-0.5 hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                <span className="truncate max-w-[120px]" title={activeProfile.name}>{activeProfile.name}</span>
                <IconChevronDown size={10} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-52 bg-[#0f0f16]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-2 flex flex-col animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/50 z-50">
                    <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Select Profile</div>
                    {profiles.map(p => (
                        <button 
                            key={p.id}
                            onClick={() => { setActiveProfile(p.id); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 transition-all mx-1 rounded-lg ${activeProfile.id === p.id ? 'bg-vibe-accent/20 text-white' : 'text-slate-400 hover:bg-white/5'}`}
                        >
                            <p className="font-semibold text-xs truncate">{p.name}</p>
                            <p className="text-slate-500 font-mono text-[9px] truncate opacity-60">{p.modelId}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

const AIPanel: React.FC<AIPanelProps> = ({ onInsertCode }) => {
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore(selectMessages);
  const isGenerating = useChatStore(selectIsGenerating);
  const clearChat = useChatStore(state => state.clearChat);
  
  const activeFile = useFileTreeStore(selectActiveFile);
  const updateFileContent = useFileTreeStore(state => state.updateFileContent);
  
  const isOpen = useUIStore(selectIsAIOpen);
  const setIsAIOpen = useUIStore(state => state.setIsAIOpen);
  
  const status = useAgentStore(state => state.status);
  const agentSteps = useAgentStore(state => state.agentSteps);
  const plan = useAgentStore(state => state.plan);
  const resetAgent = useAgentStore(state => state.resetAgent);
  const startAgent = useAgentStore(state => state.startAgent);

  const isAgentRunning = useMemo(() => status === 'thinking' || status === 'executing' || status === 'planning', [status]);
  const lastStep = agentSteps[agentSteps.length - 1];

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
      return () => clearTimeout(timer);
    }
  }, [messages, agentSteps, isOpen, mode, status, plan, lastStep]);
  
  return (
    <div 
      className={`
        flex flex-col glass-panel rounded-2xl shadow-3xl 
        transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] border-white/10 overflow-hidden shrink-0
        ${isOpen ? 'w-[460px]' : 'w-0 p-0 border-0 opacity-0 pointer-events-none'}
      `}
    >
      <div className="absolute inset-0 z-[-1] opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat mix-blend-overlay"></div>
      
      <div className="flex flex-col border-b border-white/5 bg-white/5 backdrop-blur-xl z-10 shrink-0">
          <div className="flex items-center justify-between px-5 py-5 pb-3">
            <div className="flex items-center gap-4">
              <div className="relative">
                  {mode === 'agent' ? (
                    <div className="relative group">
                       <div className={`absolute inset-0 blur-xl opacity-50 animate-pulse transition-colors ${status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                       <div className="bg-black/40 p-2 rounded-xl border border-white/10 relative z-10">
                         <IconCpu size={22} className={`${status === 'completed' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-orange-400'} ${isAgentRunning ? 'animate-spin-slow' : ''}`} />
                       </div>
                    </div>
                  ) : (
                    <div className="relative group">
                       <div className="absolute inset-0 bg-vibe-accent blur-xl opacity-40 animate-pulse"></div>
                       <div className="bg-black/40 p-2 rounded-xl border border-white/10 relative z-10">
                         <IconMessage size={22} className="text-vibe-glow" />
                       </div>
                    </div>
                  )}
              </div>
              <div>
                  <h3 className="font-bold tracking-tight text-white text-base flex items-center gap-2">
                      {mode === 'chat' ? 'Vibe Chat' : 'Neural Agent'}
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 border border-white/5 text-slate-400 font-mono tracking-widest uppercase">Agent v3</span>
                  </h3>
                  <ModelSwitcher />
              </div>
            </div>
            <div className="flex items-center gap-1">
                <Tooltip content={mode === 'chat' ? "Clear Chat" : "Reset Agent"} position="left">
                  <button 
                      onClick={() => mode === 'chat' ? clearChat() : resetAgent()}
                      className="text-slate-500 hover:text-red-400 transition-all p-2.5 hover:bg-white/5 rounded-xl"
                  >
                    <IconTrash size={18} />
                  </button>
                </Tooltip>
                <Tooltip content="Close Panel" position="left">
                  <button onClick={() => setIsAIOpen(false)} className="text-slate-500 hover:text-white transition-all p-2.5 hover:bg-white/5 rounded-xl">
                    <IconClose size={20} />
                  </button>
                </Tooltip>
            </div>
          </div>

          <div className="px-5 pb-5 pt-1 flex items-center justify-between gap-2">
              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 w-full backdrop-blur-md">
                  <button 
                    onClick={() => setMode('chat')}
                    className={`
                      flex-1 flex items-center justify-center gap-2.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-300
                      ${mode === 'chat' ? 'bg-vibe-accent/30 text-white shadow-lg border border-vibe-accent/40' : 'text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    <IconMessage size={13} />
                    Chat
                  </button>
                  <button 
                    onClick={() => setMode('agent')}
                    className={`
                       flex-1 flex items-center justify-center gap-2.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-300
                      ${mode === 'agent' ? 'bg-orange-500/30 text-orange-300 shadow-lg border border-orange-500/40' : 'text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    <IconCpu size={13} />
                    Agent
                  </button>
              </div>
          </div>
          
          {mode === 'agent' && (plan.length > 0 || status === 'planning') && (
            <div className="px-5 pb-4 animate-in fade-in slide-in-from-top-2 duration-400">
                <PlanNode plan={plan} status={status} />
            </div>
          )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gradient-to-b from-transparent via-transparent to-black/40">
        {mode === 'chat' ? (
          <ChatView 
            messages={messages}
            isGenerating={isGenerating}
            onApplyCode={(c) => updateFileContent(c, true)}
            onInsertCode={onInsertCode}
          />
        ) : (
          <AgentHUD 
            status={status}
            agentSteps={agentSteps}
          />
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <AIPanelInput
        mode={mode}
        isGenerating={isGenerating}
        isAgentRunning={isAgentRunning}
        onSend={(text, contextFileIds) => {
          if (mode === 'chat') {
            useChatStore.getState().sendMessage(text, contextFileIds);
          } else {
            startAgent(text);
          }
        }}
        activeFile={activeFile}
      />
    </div>
  );
};

export default AIPanel;