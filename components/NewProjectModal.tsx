
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[420px] bg-[#0f0f16] border border-white/10 rounded-2xl shadow-3xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-vibe-accent/10 border border-vibe-accent/20">
               <IconFolderPlus size={18} className="text-vibe-glow" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">New Vibe Project</h2>
          </div>
          <button 
            onClick={() => setIsNewProjectModalOpen(false)} 
            className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md"
          >
            <IconClose size={18} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Give your new workspace a name to set the vibe.
          </p>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-vibe-accent to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none"></div>
            <input 
              ref={inputRef}
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. My Next Masterpiece"
              className="relative w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-vibe-accent transition-all placeholder-slate-600 shadow-inner"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Cool Website', 'Python Script', 'React App', 'Mini Game'].map(suggestion => (
              <button 
                key={suggestion}
                onClick={() => setProjectName(suggestion)}
                className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-slate-500 hover:text-vibe-glow hover:border-vibe-accent/30 transition-all font-medium uppercase tracking-wider"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
          <button 
            onClick={() => setIsNewProjectModalOpen(false)} 
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={!projectName.trim()}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-vibe-accent text-white border border-vibe-accent/20 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-30 disabled:shadow-none hover:scale-105 active:scale-95"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;
