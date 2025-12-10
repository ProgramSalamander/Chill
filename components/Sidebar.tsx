import React from 'react';
import { IconFileCode, IconGitBranch, IconSearch, IconSettings } from './Icons';
import { GitStatus } from '../services/gitService';

interface SidebarProps {
  activeView: 'explorer' | 'git' | null;
  setActiveView: (view: 'explorer' | 'git' | null) => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  gitStatus: GitStatus[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeView, 
  setActiveView, 
  onOpenCommandPalette, 
  onOpenSettings,
  gitStatus 
}) => {
  return (
    <div className="w-14 flex flex-col items-center py-4 gap-4 z-40 rounded-2xl glass-panel shadow-lg shrink-0 h-auto">
        <button 
        onClick={() => setActiveView(activeView === 'explorer' ? null : 'explorer')}
        className={`p-3 rounded-xl transition-all duration-300 relative group ${activeView === 'explorer' ? 'bg-vibe-accent text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        title="File Explorer (Cmd+B)"
        >
          <IconFileCode size={20} strokeWidth={1.5} />
          {activeView === 'explorer' && <div className="absolute inset-0 bg-white/20 blur-md rounded-xl animate-pulse-slow"></div>}
        </button>

        <button 
        onClick={() => setActiveView(activeView === 'git' ? null : 'git')}
        className={`p-3 rounded-xl transition-all duration-300 relative ${activeView === 'git' ? 'bg-vibe-accent text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        title="Source Control"
        >
          <div className="relative z-10">
              <IconGitBranch size={20} strokeWidth={1.5} />
              {gitStatus.filter(s => s.status !== 'unmodified').length > 0 && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-vibe-900 shadow-sm animate-pulse"></div>
              )}
          </div>
        </button>

        <button 
        onClick={onOpenCommandPalette}
        className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-105"
        title="Command Palette (Cmd+P)"
        >
          <IconSearch size={20} strokeWidth={1.5} />
        </button>
        
        <div className="w-8 h-[1px] bg-white/10 my-1"></div>
        
        <button 
        onClick={onOpenSettings}
        className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300 hover:rotate-90"
        title="Settings"
        >
          <IconSettings size={20} strokeWidth={1.5} />
        </button>
    </div>
  );
};

export default Sidebar;