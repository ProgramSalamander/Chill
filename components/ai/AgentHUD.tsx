import React from 'react';
import { AgentStep } from '../../types';
import { IconCpu } from '../Icons';
import AgentStepNode from './AgentStepNode';

interface AgentHUDProps {
  agentSteps: AgentStep[];
  isAgentRunning: boolean;
}

const AgentHUD: React.FC<AgentHUDProps> = ({ agentSteps, isAgentRunning }) => {
  return (
    <div className="px-1 pt-2 pb-10">
      {agentSteps.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[300px] text-slate-500 space-y-4 opacity-60">
          <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
            <IconCpu size={32} className="text-orange-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">Neural Agent Ready</p>
            <p className="text-xs mt-2 max-w-[250px]">Give me a high-level goal. I will plan, execute, and verify changes autonomously.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {agentSteps.map((step, idx) => (
          <AgentStepNode
            key={step.id}
            step={step}
            isLast={idx === agentSteps.length - 1}
          />
        ))}
      </div>

      {isAgentRunning && (
        <div className="relative pl-6 mt-4">
          <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-white/10 to-transparent"></div>
          <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 border-orange-500/30 bg-orange-500/10 flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-ping"></div>
          </div>
          <div className="ml-3 p-3 bg-white/5 border border-white/5 rounded-lg flex items-center gap-3">
            <div className="flex gap-1 items-end h-4">
              <div className="w-1 bg-orange-400/50 animate-[pulse_0.6s_ease-in-out_infinite] h-2"></div>
              <div className="w-1 bg-orange-400/50 animate-[pulse_0.8s_ease-in-out_infinite_0.1s] h-3"></div>
              <div className="w-1 bg-orange-400/50 animate-[pulse_1s_ease-in-out_infinite_0.2s] h-4"></div>
              <div className="w-1 bg-orange-400/50 animate-[pulse_0.7s_ease-in-out_infinite_0.3s] h-2"></div>
            </div>
            <span className="text-xs font-mono text-orange-300">Agent is working...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentHUD;
