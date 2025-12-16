
import React from 'react';
import { AgentPlanItem, AgentStatus } from '../../types';
import { IconCheck, IconCpu, IconList, IconClock, IconX } from '../Icons';

interface PlanNodeProps {
    plan: AgentPlanItem[];
    status: AgentStatus;
}

const PlanNode: React.FC<PlanNodeProps> = ({ plan, status }) => {
    
    if (status === 'planning') {
        return (
            <div className="relative pl-6 pb-6 group">
                <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white/5 border-white/10 text-slate-400 animate-pulse">
                    <IconCpu size={14} />
                </div>
                <div className="ml-3 rounded-lg border bg-white/5 border-white/10 p-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Planning...</h3>
                </div>
            </div>
        );
    }
    
    const completedCount = plan.filter(p => p.status === 'completed').length;

    return (
        <div className="relative pl-6 pb-6 group">
            {/* Timeline connectors */}
            <div className="absolute left-[11px] top-6 bottom-[-1rem] w-[2px] bg-white/5 group-hover:bg-white/10 transition-colors"></div>
            <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white/5 border-white/10 text-slate-400">
                <IconList size={14} />
            </div>

            <div className="ml-3 rounded-lg border bg-white/5 border-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Plan Generated</h3>
                    <span className="text-[10px] text-slate-500 font-mono bg-black/40 px-1.5 rounded">{completedCount} / {plan.length} completed</span>
                </div>
                <div className="space-y-1.5">
                    {plan.map(step => {
                        const isCompleted = step.status === 'completed';
                        const isActive = step.status === 'active';
                        const isFailed = step.status === 'failed';

                        return (
                            <div key={step.id} className="flex items-center gap-2 text-xs">
                                <span className={`flex-shrink-0 ${
                                    isCompleted ? 'text-green-400' :
                                    isActive ? 'text-orange-400 animate-pulse' :
                                    isFailed ? 'text-red-400' : 'text-slate-600'
                                }`}>
                                    {isCompleted ? <IconCheck size={12} /> : 
                                     isFailed ? <IconX size={12} /> :
                                     isActive ? <IconCpu size={12} className="animate-spin-slow" /> : 
                                     <IconClock size={12} />}
                                </span>
                                <span className={`truncate ${isCompleted ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PlanNode;
