import React, { useState } from 'react';
import { IconClose, IconKeyRound } from './Icons';
import { useGitAuthStore } from '../stores/gitAuthStore';

const GitAuthModal: React.FC = () => {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const isAuthModalOpen = useGitAuthStore(state => state.isAuthModalOpen);
  const closeAuthModal = useGitAuthStore(state => state.closeAuthModal);

  const handleSubmit = () => {
    if (username.trim() && token.trim()) {
      closeAuthModal({ username: username.trim(), token: token.trim() });
      setUsername('');
      setToken('');
    }
  };

  const handleCancel = () => {
    closeAuthModal();
    setUsername('');
    setToken('');
  };

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[450px] bg-[#0f0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
               <IconKeyRound size={18} className="text-yellow-400" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Git Authentication Required</h2>
          </div>
          <button 
            onClick={handleCancel}
            className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md"
            aria-label="Close authentication dialog"
          >
            <IconClose size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            The remote repository requires credentials. Please enter your username and a Personal Access Token (PAT).
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., your-github-username"
              className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent placeholder-slate-600"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase">Personal Access Token (PAT)</label>
            <input 
              type="password" 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your token, not your password"
              className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent placeholder-slate-600"
            />
          </div>
          <p className="text-slate-500 text-xs mt-2">
            Using a PAT is more secure than using your password. You can create one in your Git provider's settings.
          </p>
        </div>

        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
          <button 
            onClick={handleCancel} 
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={!username.trim() || !token.trim()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-vibe-accent text-white border border-vibe-accent/20 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
          >
            Authenticate & Retry
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitAuthModal;