import React, { useState, useEffect } from 'react';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction, PreFlightResult } from '../../types';
import { IconCpu, IconCheck, IconPlay, IconX, IconEdit, IconCheckCircle, IconZap, IconShield, IconActivity, IconAlert, IconXCircle, IconClock } from '../Icons';
import AgentStepNode from './AgentStepNode';
import AgentSummaryCard from './AgentSummaryCard';

interface AgentHUDProps {
  status: AgentStatus;
  agentSteps: AgentStep[];
  plan: AgentPlanItem[];
  pendingAction: AgentPendingAction | null;
  preFlightResult?: PreFlightResult | null;
  onApprovePlan: (plan: AgentPlanItem[]) => void;
  onApproveAction: () => void;
  onRejectAction: () => void;
  onUpdateActionArgs: (args: any) => void;
  onSendFeedback?: (feedback: string) => void;
}

const AgentHUD: React.FC<AgentHUDProps> = ({
  status,
  agentSteps,
  plan,
  pendingAction,
  preFlightResult,
  onApprovePlan,
  onApproveAction,
  onRejectAction,
  onUpdateActionArgs,
  onSendFeedback
}) => {
  const [editedPlan, setEditedPlan] = useState<AgentPlanItem[]>([]);
  const [isEditingArgs, setIsEditingArgs] = useState(false);
  const [argsInput, setArgsInput] = useState('');
  const summaryStep = agentSteps.find(s => s.type === 'summary');

  useEffect(() => {
    setEditedPlan(plan);
  }, [plan]);

  useEffect(() => {
    if (pendingAction) {
      setArgsInput(JSON.stringify(pendingAction.args, null, 2));
      setIsEditingArgs(false);
    }
  }, [pendingAction]);

  const toggleStepStatus = (index: number) => {
    const newPlan = [...editedPlan];
    if (newPlan[index].status === 'pending') newPlan[index].status = 'skipped';
    else if (newPlan[index].status === 'skipped') newPlan[index].status = 'pending';
    setEditedPlan(newPlan);
  };

  const handleArgsSave = () => {
    try {
      const parsed = JSON.parse(argsInput);
      onUpdateActionArgs(parsed);
      setIsEditingArgs(false);
    } catch (e) {
      alert("Invalid JSON");
    }
  };

  const handleAutoFix = () => {
    if (!preFlightResult || !onSendFeedback) return;
    const errors = preFlightResult.diagnostics.map(d => `Line ${d.startLine}: ${d.message}`).join('\n');
    onSendFeedback(errors);
  };

  const PlanProgressTracker: React.FC<{ plan: AgentPlanItem[] }> = ({ plan }) => (
    <div className="relative pl-6">
      {plan.map((step, idx) => {
        const isLast = idx === plan.length - 1;
        const isActive = step.status === 'active';
        const isCompleted = step.status === 'completed';
        const isSkipped = step.status === 'skipped';
        const isFailed = step.status === 'failed';

        let icon;
        let iconClass = '';
        if (isActive) {
          icon = <IconActivity size={10} className="animate-spin" />;
          iconClass = 'bg-orange-500 border-orange-400 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)]';
        } else if (isCompleted) {
          icon = <IconCheck size={10} />;
          iconClass = 'bg-green-500 border-green-400 text-white';
        } else if (isSkipped) {
          icon = <IconX size={8} />;
          iconClass = 'bg-slate-700 border-slate-600 text-slate-400';
        } else if (isFailed) {
            icon = <IconX size={8} />;
            iconClass = 'bg-red-500 border-red-400 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]';
        } else {
          icon = <IconClock size={8} />;
          iconClass = 'bg-slate-800 border-slate-600 text-slate-400';
        }

        return (
          <div key={step.id} className="relative pb-5 last:pb-0">
            {!isLast && <div className="absolute left-[7px] top-5 h-full w-px bg-white/10"></div>}
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${iconClass}`}>
                {icon}
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-medium transition-colors ${isActive ? 'text-white' : 'text-slate-400'} ${isSkipped ? 'line-through' : ''}`}>
                  {step.title}
                </span>
                {isActive && step.description && (
                  <span className="text-[10px] text-slate-500">{step.description}</span>
                )}
              </div>
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

      {status !== 'idle' && !summaryStep && (
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

      {status === 'plan_review' && (
        <div className="bg-[#181824] border border-white/10 rounded-xl p-4 animate-in slide-in-from-bottom-5 z-10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <IconZap size={16} className="text-orange-400" />
            Proposed Plan
          </h3>
          <div className="space-y-2 mb-6">
            {editedPlan.map((item, idx) => (
              <div key={item.id} className="flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors group">
                <button onClick={() => toggleStepStatus(idx)} className={`mt-0.5 ${item.status === 'skipped' ? 'text-slate-600' : 'text-vibe-glow'}`}>
                  {item.status === 'skipped' ? <IconXCircle size={14} /> : <IconCheckCircle size={14} />}
                </button>
                <div className={item.status === 'skipped' ? 'opacity-50 line-through' : ''}>
                  <div className="text-xs font-bold text-slate-200">{item.title}</div>
                  <div className="text-[10px] text-slate-400">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => onApprovePlan(editedPlan)} className="bg-vibe-accent hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
              <IconPlay size={14} />
              Approve & Execute
            </button>
          </div>
        </div>
      )}

      {status !== 'idle' && status !== 'plan_review' && !summaryStep && (
        <div className="space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-3">Progress</h3>
            <PlanProgressTracker plan={plan} />
          </div>

          {(agentSteps.length > 1 || pendingAction) && (
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

          {status === 'action_review' && pendingAction && (
            <div className="bg-[#181824] border border-orange-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.1)] animate-in zoom-in-95 duration-200 z-10 mx-2">
              <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-orange-300">
                       <IconCpu size={16} />
                       <span className="text-xs font-bold uppercase tracking-wider">Proposed Action</span>
                   </div>
                   <div className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded text-slate-400">
                       {pendingAction.toolName}
                   </div>
               </div>
               
               {preFlightResult && (
                 <div className="p-4 grid gap-3 border-b border-orange-500/20">
                    <div className="grid grid-cols-3 gap-2">
                       {preFlightResult.checks.map(check => (
                           <div key={check.id} className="bg-black/20 rounded p-2 border border-white/5 flex flex-col items-center gap-2 text-center">
                               {check.status === 'running' && <IconActivity size={16} className="text-blue-400 animate-spin" />}
                               {check.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                               {check.status === 'success' && <IconCheckCircle size={16} className="text-green-400" />}
                               {check.status === 'failure' && <IconXCircle size={16} className="text-red-400" />}
                               <span className={`text-[10px] font-medium ${check.status === 'running' ? 'text-blue-300' : check.status === 'failure' ? 'text-red-300' : 'text-slate-400'}`}>
                                   {check.name}
                               </span>
                           </div>
                       ))}
                   </div>

                   {preFlightResult.diagnostics.length > 0 && (
                       <div className="bg-red-500/5 border border-red-500/20 rounded p-3 mt-1">
                           <div className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-2"> <IconAlert size={12} /> Diagnostics Found </div>
                           <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                               {preFlightResult.diagnostics.map((d, i) => (
                                   <div key={i} className="text-[10px] text-red-300 font-mono pl-2 border-l-2 border-red-500/30"> Line {d.startLine}: {d.message} </div>
                               ))}
                           </div>
                           <button onClick={handleAutoFix} className="w-full mt-3 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded py-1.5 text-xs font-bold transition-colors flex items-center justify-center gap-2">
                               <IconZap size={12} /> Fix with AI
                           </button>
                       </div>
                   )}
              </div>
               )}

               <div className="p-4">
                   {isEditingArgs ? (
                       <textarea value={argsInput} onChange={e => setArgsInput(e.target.value)} className="w-full h-40 bg-black/40 border border-vibe-accent/50 rounded p-2 text-xs font-mono text-white focus:outline-none resize-none" />
                   ) : (
                       <div className="bg-black/30 p-2 rounded border border-white/5">
                           <pre className="text-[10px] text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-40 custom-scrollbar">
                               {JSON.stringify(pendingAction.args, null, 2)}
                           </pre>
                       </div>
                   )}
               </div>

               <div className="bg-white/5 px-4 py-3 flex justify-between items-center">
                   {isEditingArgs ? (
                       <div className="flex gap-2">
                           <button onClick={handleArgsSave} className="text-xs bg-green-500/20 text-green-300 px-3 py-1.5 rounded hover:bg-green-500/30">Save</button>
                           <button onClick={() => setIsEditingArgs(false)} className="text-xs bg-white/5 text-slate-400 px-3 py-1.5 rounded hover:bg-white/10">Cancel</button>
                       </div>
                   ) : (
                       <button onClick={() => setIsEditingArgs(true)} className="text-slate-500 hover:text-white flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors"> <IconEdit size={12} /> Edit Args </button>
                   )}
                   
                   {!isEditingArgs && (
                       <div className="flex gap-2">
                           <button onClick={onRejectAction} className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"> Reject </button>
                           <button onClick={onApproveAction} disabled={preFlightResult?.hasErrors} className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-lg transition-all flex items-center gap-2 ${preFlightResult?.hasErrors ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 shadow-green-500/20'}`}>
                               <IconCheck size={14} /> Approve
                           </button>
                       </div>
                   )}
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
