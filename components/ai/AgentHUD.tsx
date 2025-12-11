

import React, { useState, useEffect } from 'react';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction } from '../../types';
import { IconCpu, IconCheck, IconPlay, IconX, IconEdit, IconCheckCircle, IconZap } from '../Icons';
import AgentStepNode from './AgentStepNode';
import CodeBlock from './CodeBlock'; // Reusing for diff view if possible, or simple block

interface AgentHUDProps {
  status: AgentStatus;
  agentSteps: AgentStep[];
  plan: AgentPlanItem[];
  pendingAction: AgentPendingAction | null;
  onApprovePlan: (plan: AgentPlanItem[]) => void;
  onApproveAction: () => void;
  onRejectAction: () => void;
  onUpdateActionArgs: (args: any) => void;
}

const AgentHUD: React.FC<AgentHUDProps> = ({ 
    status, 
    agentSteps, 
    plan, 
    pendingAction, 
    onApprovePlan,
    onApproveAction,
    onRejectAction,
    onUpdateActionArgs
}) => {
  const [editedPlan, setEditedPlan] = useState<AgentPlanItem[]>([]);
  const [isEditingArgs, setIsEditingArgs] = useState(false);
  const [argsInput, setArgsInput] = useState('');

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

  return (
    <div className="px-1 pt-2 pb-10 flex flex-col gap-4">
      
      {/* 1. Status Header */}
      {status !== 'idle' && (
          <div className="flex items-center gap-3 px-2">
               <div className={`
                    w-2 h-2 rounded-full 
                    ${status === 'thinking' || status === 'executing' ? 'bg-orange-400 animate-ping' : 
                      status === 'completed' ? 'bg-green-400' : 'bg-vibe-glow'}
               `}></div>
               <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
                   {status.replace('_', ' ')}
               </span>
          </div>
      )}

      {/* 2. Plan View (Review Mode) */}
      {status === 'plan_review' && (
          <div className="bg-[#181824] border border-white/10 rounded-xl p-4 animate-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <IconZap size={16} className="text-orange-400" />
                      Proposed Plan
                  </h3>
                  <span className="text-[10px] text-slate-500">Review steps before starting</span>
              </div>
              <div className="space-y-2 mb-6">
                  {editedPlan.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group">
                          <button 
                             onClick={() => toggleStepStatus(idx)}
                             className={`mt-0.5 ${item.status === 'skipped' ? 'text-slate-600' : 'text-vibe-glow'}`}
                          >
                              {item.status === 'skipped' ? <IconX size={14} /> : <IconCheckCircle size={14} />}
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

      {/* 3. Action Review (Pending Action) */}
      {status === 'action_review' && pendingAction && (
          <div className="bg-[#181824] border border-orange-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.1)] animate-in zoom-in-95 duration-200">
               <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-orange-300">
                       <IconCpu size={16} />
                       <span className="text-xs font-bold uppercase tracking-wider">Proposed Action</span>
                   </div>
                   <div className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded text-slate-400">
                       {pendingAction.toolName}
                   </div>
               </div>
               
               <div className="p-4">
                   {/* Special UI for writeFile */}
                   {pendingAction.toolName === 'writeFile' && !isEditingArgs ? (
                       <div className="space-y-2">
                           <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                               <span className="text-slate-500">File:</span> {pendingAction.args.path}
                           </div>
                           <div className="max-h-48 overflow-y-auto custom-scrollbar border border-white/10 rounded bg-black/30 p-2">
                               <code className="text-[10px] font-mono text-green-300 whitespace-pre-wrap">
                                   {pendingAction.args.content}
                               </code>
                           </div>
                       </div>
                   ) : (
                       /* Generic JSON Edit View */
                       isEditingArgs ? (
                           <textarea 
                               value={argsInput}
                               onChange={e => setArgsInput(e.target.value)}
                               className="w-full h-40 bg-black/40 border border-vibe-accent/50 rounded p-2 text-xs font-mono text-white focus:outline-none resize-none"
                           />
                       ) : (
                           <div className="bg-black/30 p-2 rounded border border-white/5">
                               <pre className="text-[10px] text-slate-300 whitespace-pre-wrap overflow-x-auto">
                                   {JSON.stringify(pendingAction.args, null, 2)}
                               </pre>
                           </div>
                       )
                   )}
               </div>

               <div className="bg-white/5 px-4 py-3 flex justify-between items-center">
                   {isEditingArgs ? (
                       <div className="flex gap-2">
                           <button onClick={handleArgsSave} className="text-xs bg-green-500/20 text-green-300 px-3 py-1.5 rounded hover:bg-green-500/30">Save</button>
                           <button onClick={() => setIsEditingArgs(false)} className="text-xs bg-white/5 text-slate-400 px-3 py-1.5 rounded hover:bg-white/10">Cancel</button>
                       </div>
                   ) : (
                       <button onClick={() => setIsEditingArgs(true)} className="text-slate-500 hover:text-white flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors">
                           <IconEdit size={12} /> Edit Args
                       </button>
                   )}
                   
                   {!isEditingArgs && (
                       <div className="flex gap-2">
                           <button onClick={onRejectAction} className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors">
                               Reject
                           </button>
                           <button onClick={onApproveAction} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-500 text-white shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all flex items-center gap-2">
                               <IconCheck size={14} /> Approve
                           </button>
                       </div>
                   )}
               </div>
          </div>
      )}

      {/* 4. Steps List (History & Active Plan) */}
      <div className="flex flex-col gap-1 mt-2">
          {plan.length > 0 && (
             <div className="mb-4 space-y-1">
                 <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Plan Progress</div>
                 {plan.map((item) => (
                     <div key={item.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${item.status === 'active' ? 'bg-white/5 text-white' : item.status === 'completed' ? 'text-green-400 opacity-50' : 'text-slate-500'}`}>
                         <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-vibe-glow animate-pulse' : item.status === 'completed' ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                         <span className={item.status === 'completed' ? 'line-through' : ''}>{item.title}</span>
                     </div>
                 ))}
             </div>
          )}

          {agentSteps.length === 0 && status === 'idle' && (
            <div className="flex flex-col items-center justify-center h-[200px] text-slate-500 space-y-4 opacity-60">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                    <IconCpu size={32} className="text-orange-400" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-white">Vibe Agent v2.0</p>
                    <p className="text-xs mt-2 max-w-[200px]">I will plan, review, and code with you. Enter a goal to start.</p>
                </div>
            </div>
          )}

          {agentSteps.map((step, idx) => (
            <AgentStepNode
                key={step.id}
                step={step}
                isLast={idx === agentSteps.length - 1}
            />
          ))}
      </div>
    </div>
  );
};

export default AgentHUD;