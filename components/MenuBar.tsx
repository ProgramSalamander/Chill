import React, { useState, useRef, useEffect } from 'react';
import { 
  IconPlus, 
  IconSave, 
  IconFolder,
  IconSettings,
  IconGitBranch,
  IconClock,
  IconSun,
  IconMoon,
  IconTrash
} from './Icons';
import Tooltip from './Tooltip';
import { useUIStore } from '../stores/uiStore';
import { useFileStore } from '../stores/fileStore';

const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const theme = useUIStore(state => state.theme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  const setIsSettingsOpen = useUIStore(state => state.setIsSettingsOpen);
  const setIsCloneModalOpen = useUIStore(state => state.setIsCloneModalOpen);
  const activeProject = useFileStore(state => state.activeProject);
  const recentProjects = useFileStore(state => state.recentProjects);
  const handleNewProject = useFileStore(state => state.handleNewProject);
  const handleLoadProject = useFileStore(state => state.handleLoadProject);
  const saveAllFiles = useFileStore(state => state.saveAllFiles);
  const files = useFileStore(state => state.files);
  const setProjectToDelete = useFileStore(state => state.setProjectToDelete);

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

  const projectName = activeProject?.name || (files.length > 0 ? "Draft Workspace" : undefined);

  return (
    <div className="h-10 w-full bg-vibe-900 border-b border-vibe-border flex items-center px-4 select-none z-50 shrink-0" ref={menuRef}>
      {/* Brand */}
      <div className="flex items-center gap-2 mr-6 opacity-90 hover:opacity-100 transition-opacity cursor-default">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-vibe-accent to-purple-600 flex items-center justify-center shadow-[0_0_10px_rgba(var(--vibe-accent),0.3)]">
            <span className="text-[10px] font-bold text-white">V</span>
        </div>
        <span className="font-bold text-sm text-slate-200 dark:text-slate-200 text-slate-800 tracking-tight font-sans">VibeCode</span>
      </div>

      {/* Menus */}
      <div className="flex items-center gap-1 h-full">
        
        {/* Projects Menu */}
        <div className="relative h-full flex items-center">
            <button 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${activeMenu === 'projects' ? 'bg-black/10 dark:bg-white/10 text-vibe-glow' : 'text-text-tertiary hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-secondary'}`}
                onClick={() => handleMenuClick('projects')}
            >
                Projects
            </button>
            {activeMenu === 'projects' && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-64 bg-vibe-800/95 backdrop-blur-xl border border-vibe-border rounded-xl shadow-2xl py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50">
                    <button onClick={() => { handleNewProject(); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-text-secondary hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                        <IconPlus size={14} className="text-text-tertiary group-hover:text-vibe-glow" /> 
                        <span>New Project</span>
                    </button>
                    <button onClick={() => { setIsCloneModalOpen(true); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-text-secondary hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                        <IconGitBranch size={14} className="text-text-tertiary group-hover:text-vibe-glow" /> 
                        <span>Clone Project...</span>
                    </button>
                    <div className="h-[1px] bg-vibe-border my-1 mx-2" />
                    <button onClick={() => { saveAllFiles(); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-text-secondary hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                         <IconSave size={14} className="text-text-tertiary group-hover:text-vibe-glow" /> 
                         <span>Save All</span>
                    </button>

                    {recentProjects.length > 0 && (
                      <>
                        <div className="h-[1px] bg-vibe-border my-1 mx-2" />
                        <div className="px-3 py-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                          Recent Projects
                        </div>
                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                          {recentProjects.map(proj => (
                            <div 
                              key={proj.id}
                              className="group flex items-center justify-between px-1 text-xs text-left text-text-secondary transition-colors mx-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                            >
                                <button
                                    onClick={() => { handleLoadProject(proj); closeMenu(); }}
                                    className="flex-1 flex items-center gap-3 px-2 py-2 group-hover:text-text-primary"
                                >
                                    <IconFolder size={14} className="text-text-tertiary group-hover:text-vibe-accent" />
                                    <div className="flex flex-col truncate">
                                        <span className="truncate">{proj.name}</span>
                                        <span className="text-[9px] text-text-tertiary font-normal flex items-center gap-1">
                                            <IconClock size={8} />
                                            {new Date(proj.lastOpened).toLocaleDateString()}
                                        </span>
                                    </div>
                                </button>
                                <Tooltip content="Delete Project" position="right">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProjectToDelete(proj);
                                            closeMenu();
                                        }}
                                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <IconTrash size={14}/>
                                    </button>
                                </Tooltip>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                </div>
            )}
        </div>
        
        {/* View Menu */}
         <div className="relative h-full flex items-center">
            <button 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${activeMenu === 'view' ? 'bg-black/10 dark:bg-white/10 text-vibe-glow' : 'text-text-tertiary hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-secondary'}`}
                onClick={() => handleMenuClick('view')}
            >
                View
            </button>
            {activeMenu === 'view' && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-48 bg-vibe-800/95 backdrop-blur-xl border border-vibe-border rounded-xl shadow-2xl py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50">
                     <button onClick={() => { setIsSettingsOpen(true); closeMenu(); }} className="group px-3 py-2 text-xs text-left text-text-secondary hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg">
                        <IconSettings size={14} className="text-text-tertiary group-hover:text-vibe-glow" />
                        <span>Settings</span>
                     </button>
                </div>
            )}
        </div>

      </div>
      
      {/* Active Project Indicator */}
      <div className="flex-1 flex justify-center pointer-events-none">
         {projectName && (
             <div className="flex items-center gap-2 px-4 py-1.5 bg-black/5 dark:bg-white/5 rounded-full border border-vibe-border shadow-inner">
                 <IconFolder size={12} className="text-vibe-accent opacity-70" />
                 <span className="text-xs text-text-secondary font-medium tracking-wide">{projectName}</span>
             </div>
         )}
      </div>

      <div className="flex items-center gap-2">
        <Tooltip content={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} position="bottom">
            <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-text-tertiary hover:text-text-primary bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
                {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default MenuBar;