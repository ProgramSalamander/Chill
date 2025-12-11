

import React, { useState, useRef, useEffect } from 'react';
import { Message, File } from '../types';
import { useAgent } from '../hooks/useAgent';
import { IconSparkles, IconCpu, IconClose, IconTrash } from './Icons';
import AgentHUD from './ai/AgentHUD';
import ChatView from './ai/ChatView';
import AIPanelInput from './ai/AIPanelInput';
import Tooltip from './Tooltip';

interface AIPanelProps {
  isOpen: boolean;
  messages: Message[];
  onSendMessage: (text: string, contextFileIds?: string[]) => void;
  onClearChat: () => void;
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

const AIPanel: React.FC<AIPanelProps> = (props) => {
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { 
      status,
      agentSteps,
      plan,
      pendingAction,
      startAgent,
      approvePlan,
      approveAction,
      rejectAction,
      updatePendingActionArgs,
      setAgentSteps
  } = useAgent(props.onAgentAction, props.files);

  const isAgentRunning = status === 'thinking' || status === 'executing' || status === 'planning';

  useEffect(() => {
    if (props.isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [props.messages, agentSteps, props.isOpen, mode, status, plan]); // Added status/plan deps to scroll on updates

  const handleSend = (text: string, contextFileIds?: string[]) => {
    if (mode === 'chat') {
      props.onSendMessage(text, contextFileIds);
    } else {
      startAgent(text); // Start the planning phase
    }
  };
  
  return (
    <div 
      className={`
        w-[450px] flex flex-col glass-panel absolute right-4 top-4 bottom-4 z-50 rounded-2xl shadow-2xl 
        transition-all duration-500 cubic-bezier(0.19, 1, 0.22, 1) transform border border-white/10 overflow-hidden
        ${props.isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[110%] opacity-0 pointer-events-none'}
      `}
    >
      <div className="absolute inset-0 z-[-1] opacity-5 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat opacity-20 mix-blend-overlay"></div>
      
      {/* Header */}
      <div className="flex flex-col border-b border-white/5 bg-white/5 backdrop-blur-md z-10">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                  {mode === 'agent' ? (
                    <div className="relative">
                       <div className={`absolute inset-0 blur-lg opacity-40 animate-pulse ${status === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                       <IconCpu size={24} className={`${status === 'completed' ? 'text-green-400' : 'text-orange-400'} relative z-10 ${isAgentRunning ? 'animate-spin-slow' : ''}`} />
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
                      {mode === 'chat' ? 'Vibe Chat' : 'Neural Agent'}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/5 text-slate-400 font-mono">v3.1</span>
                  </h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
                <Tooltip content={mode === 'chat' ? "Clear Chat" : "Reset Agent"} position="left">
                  <button 
                      onClick={() => mode === 'chat' ? props.onClearChat() : setAgentSteps([])}
                      className="text-slate-500 hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    <IconTrash size={16} />
                  </button>
                </Tooltip>
                <Tooltip content="Close Panel" position="left">
                  <button onClick={props.onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                    <IconClose size={18} />
                  </button>
                </Tooltip>
            </div>
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
                    <IconCpu size={12} />
                    Agent
                  </button>
              </div>
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/30">
        {mode === 'chat' ? (
          <ChatView 
            messages={props.messages}
            isGenerating={props.isGenerating}
            onApplyCode={props.onApplyCode}
            onInsertCode={props.onInsertCode}
          />
        ) : (
          <AgentHUD 
            status={status}
            agentSteps={agentSteps}
            plan={plan}
            pendingAction={pendingAction}
            onApprovePlan={approvePlan}
            onApproveAction={approveAction}
            onRejectAction={rejectAction}
            onUpdateActionArgs={updatePendingActionArgs}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <AIPanelInput
        mode={mode}
        isGenerating={props.isGenerating}
        isAgentRunning={isAgentRunning}
        onSend={handleSend}
        files={props.files}
        contextScope={props.contextScope}
        setContextScope={props.setContextScope}
        activeFile={props.activeFile}
      />
    </div>
  );
};

export default AIPanel;