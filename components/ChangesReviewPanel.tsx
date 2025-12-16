

import React from 'react';
import { useAgentStore } from '../stores/agentStore';
import { IconFilePlus, IconTrash, IconEdit } from './Icons';
import { StagedChange } from '../types';

const ChangeFileListItem: React.FC<{ change: StagedChange }> = ({ change }) => {
  const getChangeConfig = () => {
    switch(change.type) {
      case 'create': return { icon: <IconFilePlus size={14}/>, color: 'text-green-400' };
      case 'update': return { icon: <IconEdit size={14}/>, color: 'text-amber-400' };
      case 'delete': return { icon: <IconTrash size={14}/>, color: 'text-red-400' };
    }
  }
  const { icon, color } = getChangeConfig();

  const handleScrollToChange = () => {
    const element = document.getElementById(`change-${change.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <button 
      onClick={handleScrollToChange}
      className="flex w-full items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-left"
    >
      <span className={color}>{icon}</span>
      <span className="text-xs font-mono text-slate-300 truncate" title={change.path}>{change.path}</span>
    </button>
  );
};


const ChangesReviewPanel: React.FC = () => {
    const { stagedChanges, applyAllChanges, rejectAllChanges } = useAgentStore();
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 shrink-0">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Agent Changes ({stagedChanges.length})
                </div>
                <div className="flex gap-2">
                    <button 
                       onClick={() => rejectAllChanges()}
                       disabled={stagedChanges.length === 0}
                       className="flex-1 py-1.5 rounded text-xs font-bold bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                        Reject All
                    </button>
                    <button 
                       onClick={() => applyAllChanges()}
                       disabled={stagedChanges.length === 0}
                       className="flex-1 py-1.5 rounded text-xs font-bold bg-green-500/10 text-green-300 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                    >
                        Apply All
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
                {stagedChanges.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-600 italic">
                        No pending changes from the agent.
                    </div>
                ) : (
                    stagedChanges.map(change => <ChangeFileListItem key={change.id} change={change} />)
                )}
            </div>
        </div>
    );
};

export default ChangesReviewPanel;