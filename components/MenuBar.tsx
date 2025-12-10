

import React, { useState, useRef, useEffect } from 'react';
import { 
  IconPlus, 
  IconSave, 
  IconFolder,
  IconSettings,
  IconGitBranch
} from './Icons';

interface MenuBarProps {
  onNewProject: () => void;
  onSaveAll?: () => void;
  projectName?: string;
  onOpenSettings: () => void;
  onOpenCloneModal: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ 
  onNewProject, 
  onSaveAll, 
  projectName,
  onOpenSettings,
  onOpenCloneModal
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const closeMenu = () => setActiveMenu(null);

  return (
    <div className="h-10 w-full bg-[#050508] border-b border-white/5 flex items-center px-4 select-none z-50 shrink-0" ref={menuRef}>
      {/* Brand */}
      <div className="flex items-center gap-2 mr-6 opacity-90 hover:opacity-100 transition-opacity cursor-default">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-vibe-accent to-purple-600 flex items-center justify-center shadow-[0_0_10px_rgba(129,140,248,0.3)]">
            <span className="text-[10px] font-bold text-white">V</span>
        </div>
        <span className="font-bold text-sm text-slate-200 tracking-tight font-sans">VibeCode</span>
      </div>

      {/* Menus */}
      <div className="flex items-center gap-1 h-full">
        
        {/* Projects Menu */}
        <div className="relative h-full flex items-center">
            <button 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${activeMenu === 'projects' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                onClick={() => handleMenuClick('projects')}
            >
                Projects
            </button>
            {activeMenu === 'projects' && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-56 bg-[#0f0f16]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50">
                    <button onClick={() => { onNewProject(); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-slate-300 hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                        <IconPlus size={14} className="text-slate-500 group-hover:text-vibe-glow" /> 
                        <span>New Project</span>
                    </button>
                    <button onClick={() => { onOpenCloneModal(); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-slate-300 hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                        <IconGitBranch size={14} className="text-slate-500 group-hover:text-vibe-glow" /> 
                        <span>Clone Project...</span>
                    </button>
                    <div className="h-[1px] bg-white/5 my-1 mx-2" />
                    <button onClick={() => { if(onSaveAll) onSaveAll(); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-slate-300 hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                         <IconSave size={14} className="text-slate-500 group-hover:text-vibe-glow" /> 
                         <span>Save All</span>
                    </button>
                </div>
            )}
        </div>
        
        {/* View Menu */}
         <div className="relative h-full flex items-center">
            <button 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${activeMenu === 'view' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                onClick={() => handleMenuClick('view')}
            >
                View
            </button>
            {activeMenu === 'view' && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-48 bg-[#0f0f16]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50">
                     <button onClick={() => { onOpenSettings(); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-slate-300 hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                        <IconSettings size={14} className="text-slate-500 group-hover:text-vibe-glow" />
                        <span>Settings</span>
                     </button>
                </div>
            )}
        </div>

      </div>
      
      {/* Active Project Indicator */}
      <div className="flex-1 flex justify-center pointer-events-none">
         {projectName && (
             <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/5 shadow-inner">
                 <IconFolder size={12} className="text-vibe-accent opacity-70" />
                 <span className="text-xs text-slate-300 font-medium tracking-wide">{projectName}</span>
             </div>
         )}
      </div>

      <div className="w-20"></div> 
    </div>
  );
};

export default MenuBar;
