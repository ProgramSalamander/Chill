
import React, { useState, useEffect } from 'react';
import { IconClose, IconGitBranch } from './Icons';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';
import { useProjectStore } from '../stores/projectStore';

const CloneModal: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');
  const isCloneModalOpen = useUIStore(state => state.isCloneModalOpen);
  const setIsCloneModalOpen = useUIStore(state => state.setIsCloneModalOpen);
  const isCloning = useGitStore(state => state.isCloning);
  const clone = useGitStore(state => state.clone);

  useEffect(() => {
    if (isCloneModalOpen) {
      setRepoUrl(''); // Clear input on open
      setError('');
    }
  }, [isCloneModalOpen]);

  const executeClone = async (url: string) => {
    if (url.trim() && !isCloning) {
      setError('');
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const repoName = cleanUrl.split('/').pop()?.replace('.git', '') || 'cloned-project';
      
      const existingProject = useProjectStore.getState().recentProjects.find(p => p.name === repoName);
      if (existingProject) {
        setError(`A project named "${repoName}" already exists. Please rename or delete it first.`);
        return;
      }

      const newProject = await useProjectStore.getState().handleNewProject(repoName);
      if (!newProject) {
          setError('Failed to create a new project for cloning. The operation was cancelled.');
          return;
      }

      const success = await clone(url.trim());
      if (success) {
        setIsCloneModalOpen(false);
      } else {
        setError('Failed to clone repository. Please check the URL and terminal for more details.');
      }
    }
  };

  const handleConfirmClone = () => executeClone(repoUrl);

  const handleQuickClone = () => {
      const url = 'https://github.com/ProgramSalamander/Chill.git';
      setRepoUrl(url);
      executeClone(url);
  };

  if (!isCloneModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[450px] bg-vibe-800 border border-vibe-border rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
        <div className="p-5 border-b border-vibe-border flex justify-between items-center bg-vibe-700/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-vibe-accent/10 border border-vibe-accent/20">
               <IconGitBranch size={18} className="text-vibe-accent" />
            </div>
            <h2 className="text-lg font-semibold text-vibe-text-main tracking-tight">Clone Repository</h2>
          </div>
          <button 
            onClick={() => setIsCloneModalOpen(false)} 
            className="text-vibe-text-muted hover:text-vibe-text-main transition-colors p-1 hover:bg-vibe-700/50 rounded-md"
            aria-label="Close clone dialog"
          >
            <IconClose size={18} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-vibe-text-soft text-sm leading-relaxed mb-4">
            Enter the URL of the Git repository you wish to clone.
          </p>
          <input 
            type="text" 
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="e.g., https://github.com/user/repo.git"
            className="w-full bg-vibe-900 border border-vibe-border rounded-lg px-3 py-2 text-sm text-vibe-text-main focus:outline-none focus:border-vibe-accent placeholder-vibe-text-muted"
            disabled={isCloning}
          />
           {error && (
            <p className="text-red-400 text-xs mt-2 animate-in fade-in">
              {error}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-vibe-border">
            <span className="text-[10px] font-bold text-vibe-text-muted uppercase tracking-wider mb-2 block">Or clone Chill itself!</span>
            <button 
                onClick={handleQuickClone}
                disabled={isCloning}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-vibe-border bg-vibe-900/50 hover:bg-vibe-accent/10 hover:border-vibe-accent/30 transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div>
                    <div className="text-xs font-medium text-vibe-text-soft group-hover:text-vibe-text-main">Clone Chill Source</div>
                    <div className="text-[10px] text-vibe-text-muted font-mono mt-0.5">ProgramSalamander/Chill</div>
                </div>
                <div className="w-6 h-6 rounded-full bg-vibe-700/50 flex items-center justify-center group-hover:bg-vibe-accent group-hover:text-white transition-colors text-vibe-text-muted">
                    <img 
                      src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/github.svg" 
                      className="w-3 h-3 dark:invert opacity-60 group-hover:opacity-100 transition-opacity" 
                      alt="GitHub" 
                    />
                </div>
            </button>
          </div>

          <p className="text-vibe-text-muted text-xs mt-4">
            This will overwrite your current in-memory workspace.
          </p>
        </div>

        <div className="p-4 bg-vibe-700/30 border-t border-vibe-border flex justify-end gap-3">
          <button 
            onClick={() => setIsCloneModalOpen(false)} 
            className="px-4 py-2 rounded-lg text-xs font-medium text-vibe-text-soft hover:text-vibe-text-main hover:bg-vibe-700/50 transition-colors"
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
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                   <span>Cloning...</span>
                </div>
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
