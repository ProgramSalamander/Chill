import React, { useState, useEffect } from 'react';
import { AgentStep, AgentStatus, AgentPlanItem } from '../../types';
import { IconCpu, IconCheck, IconPlay, IconX, IconEdit, IconCheckCircle, IconZap, IconShield, IconActivity, IconAlert, IconXCircle, IconClock, IconNetwork, IconGitMerge } from '../Icons';
import AgentStepNode from './AgentStepNode';
import AgentSummaryCard from './AgentSummaryCard';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';

interface AgentHUDProps {
  status: AgentStatus;
  agentSteps: AgentStep[];
  plan: AgentPlanItem[];
}

const AgentHUD: React.FC<AgentHUDProps> = ({
  status,
  agentSteps,
  plan,
}) => {
  const [editedPlan, setEditedPlan] = useState<AgentPlanItem[]>([]);
  const summaryStep = agentSteps.find(s => s.type === 'summary');
  const { applyAllChanges, rejectAllChanges, stagedChanges } = useAgentStore();
  const setActiveSidebarView = useUIStore(state => state.setActiveSidebarView);

  useEffect(() => {
    setEditedPlan(plan);
  }, [plan]);

  const handleReview = () => {
    setActiveSidebarView('changes');
  };

  const PlanProgressTracker: React.FC<{ plan: AgentPlanItem[] }> = ({ plan }) => (
    <div className="flex flex-col gap-2">
      {plan.map((step, idx) => {
        const isActive = step.status === 'active';
        const isCompleted = step.status === 'completed';
        const isSkipped = step.status === 'skipped';
        const isFailed = step.status === 'failed';
        const isBlocked = step.dependencies && step.dependencies.length > 0 && !step.dependencies.every(dId => {
             const dep = plan.find(p => p.id === dId);
             return dep?.status === 'completed' || dep?.status === 'skipped';
        });

        let icon;
        let ringClass = '';
        let bgClass = '';
        
        if (isActive) {
          icon = <IconActivity size={12} className="animate-spin text-white" />;
          ringClass = 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[#0f0f16]';
          bgClass = 'bg-orange-500';
        } else if (isCompleted) {
          icon = <IconCheck size={12} className="text-white" />;
          bgClass = 'bg-green-500';
        } else if (isSkipped) {
          icon = <IconX size={10} className="text-slate-400" />;
          bgClass = 'bg-slate-700';
        } else if (isFailed) {
            icon = <IconX size={10} className="text-white" />;
            bgClass = 'bg-red-500';
        } else if (isBlocked) {
            icon = <IconClock size={10} className="text-slate-500" />;
            bgClass = 'bg-slate-800 border border-slate-700';
        } else {
          icon = <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>;
          bgClass = 'bg-slate-800 border border-slate-700';
        }

        return (
          <div key={step.id} className={`relative flex items-start gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-[#181824] border border-orange-500/20' : 'bg-white/5 border border-transparent'}`}>
             {idx !== plan.length - 1 && (
                 <div className="absolute left-[19px] top-10 bottom-[-10px] w-0.5 bg-white/5 z-0"></div>
             )}
             
             <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${ringClass}`}>
                 {icon}
             </div>
             
             <div className="flex flex-col flex-1 min-w-0">
                 <div className="flex justify-between items-start">
                     <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : isCompleted ? 'text-green-200 line-through opacity-70' : isSkipped ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                         {step.title}
                     </span>
                     {step.assignedAgent && (
                         <span className="text-[9px] uppercase tracking-wider font-mono text-slate-600 bg-black/20 px-1.5 rounded ml-2 shrink-0">
                             {step.assignedAgent}
                         </span>
                     )}
                 </div>
                 
                 {step.description && !isCompleted && !isSkipped && (
                     <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                         {step.description}
                     </p>
                 )}
                 
                 {step.dependencies && step.dependencies.length > 0 && !isCompleted && !isSkipped && (
                     <div className="flex items-center gap-1 mt-1.5">
                         <IconNetwork size={10} className="text-slate-600" />
                         <span className="text-[9px] text-slate-600 font-mono">
                             Waiting for: {step.dependencies.join(', ')}
                         </span>
                     </div>
                 )}
             </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="px-1 pt-2 pb-10 flex flex-col gap-6 relative">

      {summaryStep && (
        <AgentSummaryCard summaryText={summaryStep.text} />
      )}

      {status === 'awaiting_changes_review' && (
          <div className="bg-[#181824] border border-blue-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.1)] animate-in zoom-in-95 duration-200 z-10 mx-2">
            <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-3 flex items-center gap-3">
              <IconGitMerge size={16} className="text-blue-300" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white">Review Proposed Changes</h4>
                <p className="text-xs text-slate-400 mt-1">The agent has finished and staged {stagedChanges.length} change{stagedChanges.length > 1 ? 's' : ''}.</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button onClick={handleReview} className="w-full py-2 rounded-lg bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 text-xs font-bold transition-colors">
                View Changes
              </button>
              <div className="flex gap-3">
                <button onClick={() => rejectAllChanges()} className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-bold transition-colors">
                  Reject All
                </button>
                <button onClick={() => applyAllChanges()} className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-200 hover:bg-green-500/30 text-xs font-bold transition-colors">
                  Apply All
                </button>
              </div>
            </div>
          </div>
      )}

      {status !== 'idle' && !summaryStep && status !== 'awaiting_changes_review' && (
        <div className="flex items-center gap-3 px-2">
          <div className={`relative w-2 h-2 rounded-full ${status === 'completed' ? 'bg-green-400' : status === 'failed' ? 'bg-red-400' : 'bg-orange-400'}`}>
            {(status === 'thinking' || status === 'executing' || status === 'planning') && (
              <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping"></div>
            )}
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
            {status.replace('_', ' ')}
          </span>
        </div>
      )}

      {status !== 'idle' && status !== 'awaiting_changes_review' && !summaryStep && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between px-2 mb-3">
                 <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Task Breakdown</h3>
                 <span className="text-[9px] text-slate-600 font-mono bg-white/5 px-1.5 rounded">{plan.filter(p => p.status === 'completed').length} / {plan.length}</span>
            </div>
            <PlanProgressTracker plan={plan} />
          </div>

          {(agentSteps.length > 1) && (
             <div className="h-px bg-white/5 mx-2"></div>
          )}

          {agentSteps.length > 1 && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-3">Execution Log</h3>
              <div className="flex flex-col gap-1 mt-2">
                {agentSteps.filter(s => s.type !== 'summary' && s.type !== 'user').map((step, idx, arr) => (
                  <AgentStepNode key={step.id} step={step} isLast={idx === arr.length - 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {agentSteps.length === 0 && status === 'idle' && (
        <div className="flex flex-col items-center justify-center h-[200px] text-slate-500 space-y-4 opacity-60">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                <IconCpu size={32} className="text-orange-400" />
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-white">Vibe Agent v2.1</p>
                <p className="text-xs mt-2 max-w-[200px]">I will plan, review, and code with you. Enter a goal to start.</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default AgentHUD;
