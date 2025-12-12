import React, { useState, useEffect } from 'react';
import { IconClose, IconGitBranch } from './Icons';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';

const CloneModal: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const isCloneModalOpen = useUIStore(state => state.isCloneModalOpen);
  const setIsCloneModalOpen = useUIStore(state => state.setIsCloneModalOpen);
  const isCloning = useGitStore(state => state.isCloning);
  const clone = useGitStore(state => state.clone);

  useEffect(() => {
    if (isCloneModalOpen) {
      setRepoUrl(''); // Clear input on open
    }
  }, [isCloneModalOpen]);

  const handleConfirmClone = async () => {
    if (repoUrl.trim() && !isCloning) {
      const success = await clone(repoUrl.trim());
      if (success) {
        setIsCloneModalOpen(false);
      }
    }
  };

  if (!isCloneModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[450px] bg-[#0f0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-vibe-accent/10 border border-vibe-accent/20">
               <IconGitBranch size={18} className="text-vibe-glow" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Clone Repository</h2>
          </div>
          <button 
            onClick={() => setIsCloneModalOpen(false)} 
            className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md"
          >
            <IconClose size={18} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Enter the URL of the Git repository you wish to clone.
          </p>
          <input 
            type="text" 
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="e.g., https://github.com/user/repo.git"
            className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent placeholder-slate-600"
            disabled={isCloning}
          />
          <p className="text-slate-500 text-xs mt-2">
            This will overwrite your current in-memory workspace.
          </p>
        </div>

        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
          <button 
            onClick={() => setIsCloneModalOpen(false)} 
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            disabled={isCloning}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirmClone} 
            disabled={!repoUrl.trim() || isCloning}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-vibe-accent text-white border border-vibe-accent/20 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
          >
            {isCloning ? (
                <>
                   <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                   Cloning...
                </>
            ) : (
                'Clone Repository'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloneModal;