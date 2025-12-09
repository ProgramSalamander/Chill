
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
    <div className="w-14 flex flex-col items-center py-6 gap-6 z-40 ml-2 my-2 rounded-2xl glass-panel">
        <button 
        onClick={() => setActiveView(activeView === 'explorer' ? null : 'explorer')}
        className={`p-2.5 rounded-xl transition-all duration-300 ${activeView === 'explorer' ? 'bg-vibe-accent text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        title="File Explorer (Cmd+B)"
        >
        <IconFileCode size={22} strokeWidth={1.5} />
        </button>
        <button 
        onClick={() => setActiveView(activeView === 'git' ? null : 'git')}
        className={`p-2.5 rounded-xl transition-all duration-300 ${activeView === 'git' ? 'bg-vibe-accent text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        title="Source Control"
        >
        <div className="relative">
            <IconGitBranch size={22} strokeWidth={1.5} />
            {gitStatus.filter(s => s.status !== 'unmodified').length > 0 && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-vibe-900 shadow-sm"></div>
            )}
        </div>
        </button>
        <button 
        onClick={onOpenCommandPalette}
        className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300"
        title="Command Palette (Cmd+P)"
        >
        <IconSearch size={22} strokeWidth={1.5} />
        </button>
        
        <div className="flex-1" />
        
        <button 
        onClick={onOpenSettings}
        className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300"
        title="Settings"
        >
        <IconSettings size={22} strokeWidth={1.5} />
        </button>
    </div>
  );
};

export default Sidebar;
