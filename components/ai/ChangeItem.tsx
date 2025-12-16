
import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { StagedChange } from '../../types';
import { IconCheck, IconClose, IconChevronDown, IconFilePlus, IconTrash, IconEdit } from '../Icons';
import { vibeDarkTheme, vibeLightTheme } from '../../utils/monacoThemes';
import { getLanguage } from '../../utils/fileUtils';

interface ChangeItemProps {
  change: StagedChange;
}

const ChangeItem: React.FC<ChangeItemProps> = ({ change }) => {
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
    <div id={`change-${change.id}`} className="bg-white/[.02] rounded-lg border border-white/5 overflow-hidden scroll-mt-4">
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
             <span className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`}><IconChevronDown size={16} className="text-slate-500" /></span>
             <span className={color}>{icon}</span>
             <span className="text-sm font-mono text-slate-300 truncate" title={change.path}>{change.path}</span>
          </div>
          <div className="flex items-center gap-2">
             <span className={`text-[10px] font-bold px-1.5 rounded-sm bg-black/40 ${color}`}>{label}</span>
             <button onClick={(e) => { e.stopPropagation(); rejectChange(change.id) }} className="p-1.5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors" title="Reject Change"><IconClose size={14}/></button>
             <button onClick={(e) => { e.stopPropagation(); applyChange(change.id) }} className="p-1.5 rounded-full hover:bg-green-500/20 text-slate-400 hover:text-green-300 transition-colors" title="Apply Change"><IconCheck size={14}/></button>
          </div>
        </div>
        
        {isExpanded && (
            <div className="h-[50vh] min-h-[300px] animate-in fade-in duration-200 bg-black/20">
               {change.type === 'update' && (
                   <DiffEditor
                       height="100%"
                       language={getLanguage(change.path)}
                       original={change.oldContent}
                       modified={change.newContent}
                       theme={theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme'}
                       options={{ readOnly: true, minimap: { enabled: false }, renderSideBySide: false }}
                       onMount={(editor, monaco) => {
                          monaco.editor.defineTheme('vibe-dark-theme', vibeDarkTheme);
                          monaco.editor.defineTheme('vibe-light-theme', vibeLightTheme);
                       }}
                   />
               )}
               {change.type === 'create' && (
                   <DiffEditor
                       height="100%"
                       language={getLanguage(change.path)}
                       original={""}
                       modified={change.newContent}
                       theme={theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme'}
                       options={{ readOnly: true, minimap: { enabled: false }, renderSideBySide: false }}
                       onMount={(editor, monaco) => {
                          monaco.editor.defineTheme('vibe-dark-theme', vibeDarkTheme);
                          monaco.editor.defineTheme('vibe-light-theme', vibeLightTheme);
                       }}
                   />
               )}
               {change.type === 'delete' && (
                   <DiffEditor
                       height="100%"
                       language={getLanguage(change.path)}
                       original={change.oldContent}
                       modified={""}
                       theme={theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme'}
                       options={{ readOnly: true, minimap: { enabled: false }, renderSideBySide: false }}
                       onMount={(editor, monaco) => {
                          monaco.editor.defineTheme('vibe-dark-theme', vibeDarkTheme);
                          monaco.editor.defineTheme('vibe-light-theme', vibeLightTheme);
                       }}
                   />
               )}
            </div>
        )}
    </div>
  );
};

export default ChangeItem;
