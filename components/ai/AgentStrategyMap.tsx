

import React, { useEffect, useRef, useState } from 'react';
import { AgentStep, AgentPlanItem, AgentPendingAction } from '../../types';
import { 
  IconCheckCircle, 
  IconCpu, 
  IconFileCode, 
  IconTerminal, 
  IconZap, 
  IconShield,
  IconArrowRight,
  IconSearch,
  IconEye,
  IconEdit,
  IconBrain,
  IconAlert,
  IconXCircle
} from '../Icons';

interface AgentStrategyMapProps {
  plan: AgentPlanItem[];
  agentSteps: AgentStep[];
  pendingAction: AgentPendingAction | null;
  status: string;
}

const AgentStrategyMap: React.FC<AgentStrategyMapProps> = ({ plan, agentSteps, pendingAction, status }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeThought, setActiveThought] = useState<string>('');
  const lastError = [...agentSteps].reverse().find(s => s.type === 'error');

  useEffect(() => {
    // Find the latest thought to display in the active node context
    const reversedSteps = [...agentSteps].reverse();
    const thought = reversedSteps.find(s => s.type === 'thought');
    if (thought) {
      setActiveThought(thought.text);
    }
  }, [agentSteps]);

  const getStepIcon = (title: string, description: string) => {
    const text = (title + description).toLowerCase();
    if (text.includes('read') || text.includes('check')) return <IconEye size={14} />;
    if (text.includes('write') || text.includes('update') || text.includes('create')) return <IconEdit size={14} />;
    if (text.includes('search') || text.includes('find')) return <IconSearch size={14} />;
    return <IconZap size={14} />;
  };

  const getToolIcon = (toolName: string) => {
    if (toolName === 'readFile' || toolName === 'writeFile') return <IconFileCode size={16} />;
    if (toolName === 'runCommand') return <IconTerminal size={16} />;
    if (toolName === 'searchCode') return <IconSearch size={16} />;
    return <IconCpu size={16} />;
  };

  // Determine the file target if applicable for visualization
  const getActionTarget = (action: AgentPendingAction) => {
    if (action.toolName === 'readFile' || action.toolName === 'writeFile') {
      return { type: 'file', label: action.args.path };
    }
    if (action.toolName === 'runCommand') {
      return { type: 'cmd', label: action.args.command?.split(' ')[0] || 'Command' };
    }
    if (action.toolName === 'searchCode') {
        return { type: 'search', label: 'Codebase' };
    }
    return null;
  };

  const goal = agentSteps.find(s => s.type === 'user')?.text || "Execute Task";

  return (
    <div className="relative flex flex-col items-center w-full py-6 select-none" ref={containerRef}>
      
      {/* 1. Goal Node (Root) */}
      <div className="relative z-10 animate-in zoom-in-95 duration-300">
        <div className="bg-vibe-accent/20 border border-vibe-accent/30 text-vibe-glow px-4 py-2 rounded-full shadow-[0_0_20px_rgba(129,140,248,0.2)] flex items-center gap-3">
          <div className="bg-vibe-accent/20 p-1.5 rounded-full animate-pulse-slow">
             <IconBrain size={16} />
          </div>
          <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Objective</span>
              <span className="text-xs font-semibold max-w-[200px] truncate" title={goal}>{goal}</span>
          </div>
        </div>
        {/* Connector Line */}
        <div className="absolute left-1/2 top-full h-8 w-0.5 bg-gradient-to-b from-vibe-accent/50 to-slate-700/30 -translate-x-1/2"></div>
      </div>

      {/* 2. Plan Sequence */}
      <div className="flex flex-col items-center w-full mt-8 gap-0 relative">
        {/* Continuous backbone line */}
        <div className="absolute top-0 bottom-0 left-[22px] w-0.5 bg-white/5 z-0"></div>

        {plan.map((step, idx) => {
            const isActive = step.status === 'active';
            const isCompleted = step.status === 'completed';
            const isSkipped = step.status === 'skipped';
            const isPending = step.status === 'pending';
            const isFailed = step.status === 'failed';

            return (
                <div key={step.id} className="relative w-full pl-14 pr-2 pb-8 last:pb-0 z-10 group">
                    {/* Node Dot */}
                    <div className={`
                        absolute left-4 top-0 w-3 h-3 -translate-x-[1px] rounded-full border-2 transition-all duration-500
                        ${isActive ? 'bg-orange-500 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.6)] scale-125' : 
                          isCompleted ? 'bg-green-500 border-green-400' : 
                          isSkipped ? 'bg-slate-700 border-slate-600' : 
                          isFailed ? 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)] scale-125' : 'bg-[#0f0f16] border-slate-600'}
                    `}></div>

                    {/* Step Card */}
                    <div className={`
                        relative p-3 rounded-xl border transition-all duration-300
                        ${isActive ? 'bg-[#181824] border-orange-500/30 shadow-[0_0_20px_rgba(0,0,0,0.3)]' : 
                          isCompleted ? 'bg-white/5 border-green-500/20 opacity-70 hover:opacity-100' : 
                          isSkipped ? 'bg-white/5 border-white/5 opacity-40 grayscale' : 
                          isFailed ? 'bg-red-900/30 border-red-500/30' : 'bg-white/5 border-white/10 opacity-60'}
                    `}>
                        <div className="flex items-center justify-between mb-1">
                            <h4 className={`text-xs font-bold ${isActive ? 'text-white' : isCompleted ? 'text-green-200' : isFailed ? 'text-red-200' : 'text-slate-400'}`}>
                                {step.title}
                            </h4>
                            <div className="text-slate-500">
                                {isCompleted && <IconCheckCircle size={12} className="text-green-400" />}
                                {isFailed && <IconXCircle size={12} className="text-red-400" />}
                                {isActive && <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping"></div>}
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
                            {step.description}
                        </p>

                        {/* FAILED STATE EXPANSION */}
                        {isFailed && lastError && (
                            <div className="mt-4 pt-3 border-t border-red-500/20 animate-in slide-in-from-top-2">
                                <div className="flex gap-3">
                                    <IconAlert size={14} className="text-red-400 shrink-0 mt-0.5" />
                                    <div className="text-[10px] text-red-200 bg-black/30 p-2 rounded-lg border border-red-500/20 relative">
                                        <div className="absolute -left-1.5 top-2 w-2 h-2 bg-black/30 border-l border-t border-red-500/20 -rotate-45"></div>
                                        <strong className="text-red-300 block mb-1">Execution Failed:</strong>
                                        {lastError.text}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ACTIVE STATE EXPANSION */}
                        {isActive && (
                            <div className="mt-4 pt-3 border-t border-white/5 animate-in slide-in-from-top-2">
                                {/* Thought Bubble */}
                                {activeThought && (
                                    <div className="flex gap-3 mb-3">
                                        <IconCpu size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                        <div className="text-[10px] text-slate-300 italic bg-black/30 p-2 rounded-lg border border-white/5 relative">
                                            <div className="absolute -left-1.5 top-2 w-2 h-2 bg-black/30 border-l border-t border-white/5 -rotate-45"></div>
                                            "{activeThought.length > 100 ? activeThought.slice(0, 100) + '...' : activeThought}"
                                        </div>
                                    </div>
                                )}

                                {/* Branching Action */}
                                {pendingAction && (
                                    <div className="relative pl-6 mt-4">
                                        {/* L-shaped connector */}
                                        <div className="absolute left-1 top-[-10px] bottom-1/2 w-4 border-l-2 border-b-2 border-dashed border-vibe-accent/30 rounded-bl-xl"></div>
                                        
                                        <div className="bg-vibe-accent/10 border border-vibe-accent/20 rounded-lg p-2 flex items-center gap-3 shadow-lg relative overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-vibe-accent"></div>
                                            <div className="p-1.5 bg-vibe-accent/20 rounded text-vibe-glow">
                                                {getToolIcon(pendingAction.toolName)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] font-bold text-vibe-glow uppercase tracking-wider mb-0.5">
                                                    Action Required
                                                </div>
                                                <div className="text-xs text-white truncate font-mono">
                                                    {pendingAction.toolName}
                                                </div>
                                            </div>
                                            
                                            {/* Target Visualization */}
                                            {getActionTarget(pendingAction) && (
                                                <>
                                                    <IconArrowRight size={12} className="text-slate-500" />
                                                    <div className="bg-black/40 px-2 py-1 rounded border border-white/10 flex items-center gap-2 max-w-[120px]">
                                                        <IconFileCode size={10} className="text-indigo-300" />
                                                        <span className="text-[10px] text-indigo-100 truncate">
                                                            {getActionTarget(pendingAction)?.label}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        
                                        <div className="mt-1 text-[9px] text-right text-slate-500 italic pr-1">
                                            Waiting for approval...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        })}

        {plan.length === 0 && (
             <div className="flex flex-col items-center gap-2 mt-4 opacity-50 animate-pulse">
                 <div className="w-0.5 h-12 bg-white/5"></div>
                 <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs text-slate-400">
                     Analyzing Request...
                 </div>
             </div>
        )}
      </div>
    </div>
  );
};

export default AgentStrategyMap;