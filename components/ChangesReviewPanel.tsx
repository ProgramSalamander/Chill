
import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useAgentStore } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';
import { StagedChange } from '../types';
import { IconCheck, IconClose, IconChevronDown, IconChevronRight, IconFilePlus, IconTrash, IconEdit } from './Icons';
import { vibeDarkTheme, vibeLightTheme } from '../utils/monacoThemes';

const ChangeItem: React.FC<{ change: StagedChange }> = ({ change }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { applyChange, rejectChange } = useAgentStore();
  const theme = useUIStore(state => state.theme);

  const getChangeConfig = () => {
    switch(change.type) {
      case 'create': return { icon: <IconFilePlus size={14}/>, color: 'text-green-400', label: 'CREATE' };
      case 'update': return { icon: <IconEdit size={14}/>, color: 'text-amber-400', label: 'UPDATE' };
      case 'delete': return { icon: <IconTrash size={14}/>, color: 'text-red-400', label: 'DELETE' };
    }
  }

  const { icon, color, label } = getChangeConfig();
  
  return (
    <div className="bg-white/5 rounded-lg border border-white/5 overflow-hidden">
        <div 
          className="flex items-center justify-between p-2 cursor-pointer hover:bg-white/5"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
             <span className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`}><IconChevronDown size={14} className="text-slate-500" /></span>
             <span className={color}>{icon}</span>
             <span className="text-xs font-mono text-slate-300 truncate" title={change.path}>{change.path}</span>
          </div>
          <div className="flex items-center gap-2">
             <span className={`text-[9px] font-bold px-1.5 rounded-sm bg-black/40 ${color}`}>{label}</span>
             <button onClick={(e) => { e.stopPropagation(); rejectChange(change.id) }} className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"><IconClose size={14}/></button>
             <button onClick={(e) => { e.stopPropagation(); applyChange(change.id) }} className="p-1 rounded hover:bg-green-500/20 text-slate-500 hover:text-green-400 transition-colors"><IconCheck size={14}/></button>
          </div>
        </div>
        
        {isExpanded && (
            <div className="h-80 border-t border-white/5 animate-in fade-in duration-200">
               {change.type === 'update' && (
                   <DiffEditor
                       height="100%"
                       language="typescript" // Should be dynamic
                       original={change.oldContent}
                       modified={change.newContent}
                       theme={theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme'}
                       options={{ readOnly: true, minimap: { enabled: false } }}
                       onMount={(editor, monaco) => {
                          monaco.editor.defineTheme('vibe-dark-theme', vibeDarkTheme);
                          monaco.editor.defineTheme('vibe-light-theme', vibeLightTheme);
                       }}
                   />
               )}
               {change.type === 'create' && (
                   <DiffEditor
                       height="100%"
                       language="typescript"
                       original={""}
                       modified={change.newContent}
                       theme={theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme'}
                       options={{ readOnly: true, minimap: { enabled: false } }}
                       onMount={(editor, monaco) => {
                          monaco.editor.defineTheme('vibe-dark-theme', vibeDarkTheme);
                          monaco.editor.defineTheme('vibe-light-theme', vibeLightTheme);
                       }}
                   />
               )}
               {change.type === 'delete' && (
                    <div className="p-4 text-xs text-slate-500 italic">
                        This file will be permanently deleted.
                    </div>
               )}
            </div>
        )}
    </div>
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

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                {stagedChanges.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-600 italic">
                        No pending changes from the agent.
                    </div>
                ) : (
                    stagedChanges.map(change => <ChangeItem key={change.id} change={change} />)
                )}
            </div>
        </div>
    );
};

export default ChangesReviewPanel;
