import React, { useState, useRef, useEffect } from 'react';
import AgentHUD from './ai/AgentHUD';
import ChatView from './ai/ChatView';
import AIPanelInput from './ai/AIPanelInput';
import Tooltip from './Tooltip';
import { IconSparkles, IconCpu, IconClose, IconTrash } from './Icons';

import { useChatStore } from '../stores/chatStore';
import { useFileStore } from '../stores/fileStore';
import { useAgentStore } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';

interface AIPanelProps {
  onInsertCode: (code: string) => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ onInsertCode }) => {
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State from Stores
  const messages = useChatStore(state => state.messages);
  const isGenerating = useChatStore(state => state.isGenerating);
  const clearChat = useChatStore(state => state.clearChat);
  const activeFile = useFileStore(state => state.activeFile);
  const updateFileContent = useFileStore(state => state.updateFileContent);
  const isOpen = useUIStore(state => state.isAIOpen);
  const setIsAIOpen = useUIStore(state => state.setIsAIOpen);
  const status = useAgentStore(state => state.status);
  const agentSteps = useAgentStore(state => state.agentSteps);
  const plan = useAgentStore(state => state.plan);
  const pendingAction = useAgentStore(state => state.pendingAction);
  const preFlightResult = useAgentStore(state => state.preFlightResult);
  const resetAgent = useAgentStore(state => state.resetAgent);
  const startAgent = useAgentStore(state => state.startAgent);
  const approvePlan = useAgentStore(state => state.approvePlan);
  const approveAction = useAgentStore(state => state.approveAction);
  const rejectAction = useAgentStore(state => state.rejectAction);
  const updatePendingActionArgs = useAgentStore(state => state.updatePendingActionArgs);
  const sendFeedback = useAgentStore(state => state.sendFeedback);

  const isAgentRunning = status === 'thinking' || status === 'executing' || status === 'planning';
  const lastStep = agentSteps[agentSteps.length - 1];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, agentSteps, isOpen, mode, status, plan, lastStep]);
  
  return (
    <div 
      className={`
        flex flex-col glass-panel rounded-2xl shadow-2xl 
        transition-all duration-300 ease-in-out border-white/10 overflow-hidden shrink-0
        ${isOpen ? 'w-[450px]' : 'w-0 p-0 border-0 opacity-0'}
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
                       <div className={`absolute inset-0 blur-lg opacity-40 animate-pulse ${status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                       <IconCpu size={24} className={`${status === 'completed' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-orange-400'} relative z-10 ${isAgentRunning ? 'animate-spin-slow' : ''}`} />
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
                      onClick={() => mode === 'chat' ? clearChat() : resetAgent()}
                      className="text-slate-500 hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    <IconTrash size={16} />
                  </button>
                </Tooltip>
                <Tooltip content="Close Panel" position="left">
                  <button onClick={() => setIsAIOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
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
            messages={messages}
            isGenerating={isGenerating}
            onApplyCode={(c) => updateFileContent(c, true)}
            onInsertCode={onInsertCode}
          />
        ) : (
          <AgentHUD 
            status={status}
            agentSteps={agentSteps}
            plan={plan}
            pendingAction={pendingAction}
            preFlightResult={preFlightResult}
            onApprovePlan={approvePlan}
            onApproveAction={approveAction}
            onRejectAction={rejectAction}
            onUpdateActionArgs={updatePendingActionArgs}
            onSendFeedback={sendFeedback}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
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
