

import React, { useState } from 'react';
import { AgentPlanItem, AgentStatus } from '../../types';
import { IconCheck, IconCpu, IconList, IconClock, IconX, IconChevronDown } from '../Icons';

interface PlanNodeProps {
    plan: AgentPlanItem[];
    status: AgentStatus;
}

const PlanNode: React.FC<PlanNodeProps> = ({ plan, status }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    if (status === 'planning') {
        return (
            <div className="rounded-lg border bg-white/5 border-white/10 p-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <IconCpu size={14} className="animate-spin-slow" />
                    <span>Planning...</span>
                </h3>
            </div>
        );
    }
    
    const completedCount = plan.filter(p => p.status === 'completed').length;
    const activeStep = plan.find(p => p.status === 'active');

    return (
        <div className="rounded-lg border bg-white/5 border-white/10 p-3 transition-all">
            <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <IconList size={14} />
                    <span>Execution Plan</span>
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono bg-black/40 px-1.5 rounded">{completedCount} / {plan.length} completed</span>
                    <IconChevronDown size={14} className={`text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                </div>
            </div>
            
            {!isExpanded && activeStep && (
                <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                    <span className="flex-shrink-0 text-orange-400">
                        <IconCpu size={12} className="animate-spin" />
                    </span>
                    <span className="truncate text-orange-200 font-semibold">
                        {activeStep.title}
                    </span>
                </div>
            )}

            {isExpanded && (
                <div className="space-y-1.5 mt-2 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                    {plan.map(step => {
                        const isCompleted = step.status === 'completed';
                        const isActive = step.status === 'active';
                        const isFailed = step.status === 'failed';

                        return (
                            <div key={step.id} className="flex items-center gap-2 text-xs">
                                <span className={`flex-shrink-0 ${
                                    isCompleted ? 'text-green-400' :
                                    isActive ? 'text-orange-400' :
                                    isFailed ? 'text-red-400' : 'text-slate-600'
                                }`}>
                                    {isCompleted ? <IconCheck size={12} /> : 
                                    isFailed ? <IconX size={12} /> :
                                    isActive ? <IconCpu size={12} className="animate-spin" /> : 
                                    <IconClock size={12} />}
                                </span>
                                <span className={`truncate transition-colors ${
                                    isCompleted ? 'line-through text-slate-500' : 
                                    isActive ? 'text-orange-200 font-semibold' :
                                    'text-slate-300'
                                }`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PlanNode;
