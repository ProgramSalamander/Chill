import React, { useState, useEffect, useRef, useMemo } from 'react';
import { File } from '../types';
import { 
  IconSearch, 
  IconFileCode, 
  IconChevronRight,
  IconFilePlus,
  IconTerminal,
  IconSettings,
  IconGitBranch
} from './Icons';
import { useUIStore } from '../../stores/uiStore';
import { useFileStore } from '../../stores/fileStore';
import { useGitStore } from '../../stores/gitStore';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
}

const CommandPalette: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { isCommandPaletteOpen, setIsCommandPaletteOpen, setIsTerminalOpen, setIsSettingsOpen, setActiveSidebarView } = useUIStore();
  const { files, selectFile, createNode } = useFileStore();
  const { refresh } = useGitStore();

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  const actions: CommandAction[] = [
      { id: 'new_file', label: 'New File', icon: <IconFilePlus size={16} />, run: () => createNode('file', null, `file_${Date.now()}.ts`) },
      { id: 'toggle_term', label: 'Toggle Terminal', icon: <IconTerminal size={16} />, run: () => setIsTerminalOpen(!useUIStore.getState().isTerminalOpen) },
      { id: 'settings', label: 'Settings', icon: <IconSettings size={16} />, run: () => setIsSettingsOpen(true) },
      { id: 'git', label: 'Git Status', icon: <IconGitBranch size={16} />, run: () => { 
        setActiveSidebarView('git');
        refresh();
      } },
  ];

  const filteredFiles = useMemo(() => {
    if (!query) return files.filter(f => f.type === 'file');
    return files.filter(f => f.type === 'file' && f.name.toLowerCase().includes(query.toLowerCase()));
  }, [files, query]);

  const filteredActions = useMemo(() => {
    if (!query) return actions;
    return actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));
  }, [actions, query]);

  const flatItems = useMemo(() => [
    ...filteredFiles.map(f => ({ type: 'file' as const, data: f })),
    ...filteredActions.map(a => ({ type: 'action' as const, data: a }))
  ], [filteredFiles, filteredActions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (flatItems.length > 0 && listRef.current) {
        const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    }
  }, [selectedIndex, flatItems.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (flatItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (flatItems.length || 1)) % (flatItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems.length > 0) {
        const item = flatItems[selectedIndex];
        if (item.type === 'file') {
          selectFile(item.data);
        } else {
          item.data.run();
        }
        setIsCommandPaletteOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCommandPaletteOpen(false)}>
      <div 
        className="w-[600px] max-w-[90vw] bg-[#0f0f16] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/5">
           <IconSearch className="text-slate-500 w-5 h-5 mr-3" />
           <input 
             ref={inputRef}
             type="text"
             className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 font-sans text-sm"
             placeholder="Type a command or search files..."
             value={query}
             onChange={e => setQuery(e.target.value)}
             onKeyDown={handleKeyDown}
           />
           <div className="flex gap-1">
             <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-slate-500">
               ESC
             </kbd>
           </div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2" ref={listRef}>
           {flatItems.length === 0 ? (
             <div className="py-8 text-center text-slate-500 text-sm">
               No results found.
             </div>
           ) : (
             <>
               {flatItems.map((item, index) => {
                 const isSelected = index === selectedIndex;
                 if (item.type === 'file') {
                   return (
                     <div 
                        key={`file-${item.data.id}`}
                        onClick={() => { selectFile(item.data); setIsCommandPaletteOpen(false); }}
                        className={`
                          flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm mb-1
                          ${isSelected ? 'bg-vibe-accent/20 text-white' : 'text-slate-400 hover:bg-white/5'}
                        `}
                     >
                       <div className="flex items-center gap-3">
                         <IconFileCode size={16} className={isSelected ? 'text-vibe-glow' : 'text-slate-600'} />
                         <span>{item.data.name}</span>
                       </div>
                       {isSelected && <IconChevronRight size={14} className="opacity-50" />}
                     </div>
                   );
                 } else {
                    return (
                     <div 
                        key={`action-${item.data.id}`}
                        onClick={() => { item.data.run(); setIsCommandPaletteOpen(false); }}
                        className={`
                          flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm mb-1
                          ${isSelected ? 'bg-vibe-accent/20 text-white' : 'text-slate-400 hover:bg-white/5'}
                        `}
                     >
                       <div className="flex items-center gap-3">
                         <div className={isSelected ? 'text-vibe-glow' : 'text-slate-600'}>
                             {item.data.icon}
                         </div>
                         <span>{item.data.label}</span>
                       </div>
                       {item.data.shortcut && (
                         <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-600'}`}>
                           {item.data.shortcut}
                         </span>
                       )}
                     </div>
                   );
                 }
               })}
             </>
           )}
        </div>
        
        <div className="px-4 py-2 bg-vibe-900 border-t border-white/5 text-[10px] text-slate-600 flex justify-between items-center">
            <span>
              <span className="text-vibe-glow">↑↓</span> to navigate
            </span>
            <span>
              <span className="text-vibe-glow">↵</span> to select
            </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
