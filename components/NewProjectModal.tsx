import React, { useState, useEffect, useRef } from 'react';
import { IconClose, IconPlus, IconFolderPlus } from './Icons';
import { useUIStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';

const NewProjectModal: React.FC = () => {
  const [projectName, setProjectName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isNewProjectModalOpen = useUIStore(state => state.isNewProjectModalOpen);
  const setIsNewProjectModalOpen = useUIStore(state => state.setIsNewProjectModalOpen);
  const handleNewProject = useProjectStore(state => state.handleNewProject);

  useEffect(() => {
    if (isNewProjectModalOpen) {
      setProjectName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isNewProjectModalOpen]);

  const handleConfirm = async () => {
    if (projectName.trim()) {
      await handleNewProject(projectName.trim());
      setIsNewProjectModalOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      setIsNewProjectModalOpen(false);
    }
  };

  if (!isNewProjectModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[420px] bg-vibe-800 border border-vibe-border rounded-3xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-vibe-border flex justify-between items-center bg-vibe-700/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-vibe-accent/10 border border-vibe-accent/20">
               <IconFolderPlus size={18} className="text-vibe-accent" />
            </div>
            <h2 className="text-lg font-bold text-vibe-text-main tracking-tight">New Vibe Project</h2>
          </div>
          <button 
            onClick={() => setIsNewProjectModalOpen(false)} 
            className="text-vibe-text-muted hover:text-vibe-text-main transition-colors p-1.5 hover:bg-vibe-700/50 rounded-lg"
          >
            <IconClose size={18} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          <p className="text-vibe-text-soft text-sm leading-relaxed mb-5">
            Give your new workspace a name to set the vibe.
          </p>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-vibe-accent to-purple-600 rounded-2xl blur opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"></div>
            <input 
              ref={inputRef}
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. My Next Masterpiece"
              className="relative w-full bg-vibe-900 border border-vibe-border rounded-2xl px-4 py-4 text-sm text-vibe-text-main focus:outline-none focus:ring-2 focus:ring-vibe-accent/20 focus:border-vibe-accent transition-all placeholder-vibe-text-muted/50 shadow-inner"
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Cool Website', 'Python Script', 'React App', 'Mini Game'].map(suggestion => (
              <button 
                key={suggestion}
                onClick={() => setProjectName(suggestion)}
                className="px-3 py-1.5 rounded-lg bg-vibe-700/50 border border-vibe-border text-[10px] text-vibe-text-muted hover:text-vibe-glow hover:border-vibe-accent/40 transition-all font-bold uppercase tracking-wider"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-vibe-700/30 border-t border-vibe-border flex justify-end gap-3">
          <button 
            onClick={() => setIsNewProjectModalOpen(false)} 
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-vibe-text-soft hover:text-vibe-text-main hover:bg-vibe-700/50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={!projectName.trim()}
            className="px-7 py-2.5 rounded-xl text-xs font-bold bg-vibe-accent text-white border border-vibe-accent/20 hover:bg-indigo-500 transition-all shadow-lg shadow-vibe-accent/20 disabled:opacity-30 disabled:shadow-none hover:scale-105 active:scale-95"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;