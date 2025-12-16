import React from 'react';
import { AgentStep, AgentStatus, AgentPlanItem } from '../../types';
import { IconCpu, IconGitMerge, IconSparkles } from '../Icons';
import AgentStepNode from './AgentStepNode';
import AgentSummaryCard from './AgentSummaryCard';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import PlanNode from './PlanNode';

const GoalNode: React.FC<{ step: AgentStep }> = ({ step }) => (
  <div className="relative pl-6 pb-6 group">
    <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-vibe-accent/10 border-vibe-accent/30 text-vibe-glow shadow-[0_0_10px_rgba(0,0,0,0.2)]">
      <IconSparkles size={14} />
    </div>
    <div className="absolute left-[11px] top-6 bottom-[-1rem] w-[2px] bg-white/5 group-hover:bg-white/10 transition-colors"></div>
    <div className="ml-3 rounded-lg border bg-vibe-accent/10 border-vibe-accent/30 p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-vibe-glow mb-1">Objective</h3>
      <p className="text-sm text-slate-300 whitespace-pre-wrap">{step.text}</p>
    </div>
  </div>
);

const ChangesReviewNode: React.FC = () => {
    const { applyAllChanges, rejectAllChanges, stagedChanges } = useAgentStore();
    const setActiveSidebarView = useUIStore(state => state.setActiveSidebarView);

    const handleReview = () => {
        setActiveSidebarView('changes');
    };

    return (
        <div className="relative pl-6">
            <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-blue-500/10 border-blue-500/30 text-blue-300 shadow-[0_0_10px_rgba(0,0,0,0.2)]">
                <IconGitMerge size={14} />
            </div>
             <div className="ml-3 bg-[#181824] border border-blue-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <div className="p-4">
                    <h4 className="text-sm font-bold text-white mb-1">Review Proposed Changes</h4>
                    <p className="text-xs text-slate-400 mb-4">The agent has finished and staged {stagedChanges.length} change{stagedChanges.length > 1 ? 's' : ''}.</p>
                    <div className="flex flex-col gap-2">
                        <button onClick={handleReview} className="w-full py-2 rounded-lg bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 text-xs font-bold transition-colors">
                            View Changes
                        </button>
                        <div className="flex gap-2">
                            <button onClick={() => rejectAllChanges()} className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-bold transition-colors">
                            Reject All
                            </button>
                            <button onClick={() => applyAllChanges()} className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-200 hover:bg-green-500/30 text-xs font-bold transition-colors">
                            Apply All
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// FIX: Define AgentHUDProps interface
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
  const goalStep = agentSteps.find(s => s.type === 'user');
  const summaryStep = agentSteps.find(s => s.type === 'summary');
  const executionSteps = agentSteps.filter(s => s.type !== 'user' && s.type !== 'summary');
  
  const isRunning = status === 'thinking' || status === 'executing' || status === 'planning';
  
  return (
    <div className="px-1 pt-2 pb-10 flex flex-col gap-0 relative">
      {/* Idle State */}
      {status === 'idle' && agentSteps.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[200px] text-slate-500 space-y-4 opacity-60 px-4">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                <IconCpu size={32} className="text-orange-400" />
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-white">Vibe Agent v2.1</p>
                <p className="text-xs mt-2 max-w-[200px]">I will plan, review, and code with you. Enter a goal to start.</p>
            </div>
        </div>
      )}
      
      {/* Conversational Flow */}
      {status !== 'idle' && (
        <>
            {goalStep && <GoalNode step={goalStep} />}
            
            {(plan.length > 0 || status === 'planning') && <PlanNode plan={plan} status={status} />}

            {executionSteps.map((step, idx, arr) => (
                <AgentStepNode key={step.id} step={step} isLast={idx === arr.length - 1 && !summaryStep && status !== 'awaiting_changes_review'} />
            ))}

            {isRunning && executionSteps.length > 0 && (
                 <div className="relative pl-6 pb-6 group">
                    <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-white/5"></div>
                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white/5 border-white/10 text-slate-400 animate-pulse">
                        <IconCpu size={14} />
                    </div>
                 </div>
            )}

            {summaryStep && (
                <div className="relative pl-6">
                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-green-500/10 border-green-500/20 text-green-400">
                        <IconSparkles size={14} />
                    </div>
                    <div className="ml-3">
                        <AgentSummaryCard summaryText={summaryStep.text} />
                    </div>
                </div>
            )}
            
            {status === 'awaiting_changes_review' && (
                <ChangesReviewNode />
            )}
        </>
      )}

    </div>
  );
};

export default AgentHUD;