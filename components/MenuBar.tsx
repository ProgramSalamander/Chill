
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
  IconTrash,
  IconDownload,
  IconUndo,
  IconRedo,
  IconSearch,
  IconTerminal,
  IconSparkles,
  IconLayout,
  IconBrain,
  IconRefresh,
  IconEye,
  IconChevronDown
} from './Icons';
import Tooltip from './Tooltip';
import { useUIStore } from '../stores/uiStore';
import { useFileTreeStore } from '../stores/fileStore';
import { useProjectStore } from '../stores/projectStore';
import { downloadProjectAsZip } from '../utils/downloadUtils';
import { notify } from '../stores/notificationStore';
import { useChatStore } from '../stores/chatStore';

const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const theme = useUIStore(state => state.theme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  const setIsSettingsOpen = useUIStore(state => state.setIsSettingsOpen);
  const setIsCloneModalOpen = useUIStore(state => state.setIsCloneModalOpen);
  const setIsNewProjectModalOpen = useUIStore(state => state.setIsNewProjectModalOpen);
  const setIsCommandPaletteOpen = useUIStore(state => state.setIsCommandPaletteOpen);
  
  const isTerminalOpen = useUIStore(state => state.isTerminalOpen);
  const setIsTerminalOpen = useUIStore(state => state.setIsTerminalOpen);
  const isAIOpen = useUIStore(state => state.isAIOpen);
  const setIsAIOpen = useUIStore(state => state.setIsAIOpen);
  const isPreviewOpen = useUIStore(state => state.isPreviewOpen);
  const setIsPreviewOpen = useUIStore(state => state.setIsPreviewOpen);
  const activeSidebarView = useUIStore(state => state.activeSidebarView);
  const setActiveSidebarView = useUIStore(state => state.setActiveSidebarView);

  const activeProject = useProjectStore(state => state.activeProject);
  const recentProjects = useProjectStore(state => state.recentProjects);
  const handleLoadProject = useProjectStore(state => state.handleLoadProject);
  const setProjectToDelete = useProjectStore(state => state.setProjectToDelete);
  
  const { files, activeFileId, undo, redo, saveAllFiles } = useFileTreeStore();
  const activeFile = files.find(f => f.id === activeFileId);
  const clearChat = useChatStore(state => state.clearChat);
  const indexingStatus = useUIStore(state => state.indexingStatus);

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

  const handleDownloadZip = async () => {
    try {
        await downloadProjectAsZip(files, activeProject?.name || 'chill-project');
        notify('Project ZIP bundled and downloaded.', 'success');
    } catch (e: any) {
        notify(e.message || 'Failed to download project.', 'error');
    }
    closeMenu();
  };

  const menuButtonClass = (menuId: string) => `
    px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 
    ${activeMenu === menuId ? 'bg-white/10 text-vibe-glow shadow-sm' : 'text-vibe-text-soft hover:bg-white/5 hover:text-vibe-text-main'}
  `;

  const dropdownClass = "absolute top-[calc(100%+4px)] left-0 w-64 bg-vibe-800/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50 z-[100]";
  
  const itemClass = "group px-3 py-2 text-xs text-left text-vibe-text-soft hover:bg-vibe-accent/20 hover:text-white flex items-center justify-between transition-colors mx-1 rounded-lg";
  const iconLabelClass = "flex items-center gap-3";

  return (
    <div className="h-10 w-full bg-vibe-900 border-b border-vibe-border flex items-center px-4 select-none z-50 shrink-0" ref={menuRef}>
      {/* Brand */}
      <div className="flex items-center gap-2 mr-6 opacity-90 hover:opacity-100 transition-opacity cursor-default group">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-vibe-accent to-purple-600 flex items-center justify-center shadow-[0_0_10px_rgba(var(--vibe-accent),0.3)] group-hover:scale-110 transition-transform">
            <span className="text-[10px] font-bold text-white">C</span>
        </div>
        <span className="font-bold text-sm text-vibe-text-main tracking-tight font-sans">Chill</span>
      </div>

      {/* Main Navigation Menus */}
      <div className="flex items-center gap-1 h-full">
        
        {/* Project Menu */}
        <div className="relative h-full flex items-center">
            <button className={menuButtonClass('projects')} onClick={() => handleMenuClick('projects')}>Project</button>
            {activeMenu === 'projects' && (
                <div className={dropdownClass}>
                    <button onClick={() => { setIsNewProjectModalOpen(true); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconPlus size={14} className="text-vibe-text-muted group-hover:text-vibe-glow" /> <span>New Project</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⌘N</span>
                    </button>
                    <button onClick={() => { setIsCloneModalOpen(true); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconGitBranch size={14} className="text-vibe-text-muted group-hover:text-vibe-glow" /> <span>Clone...</span></div>
                    </button>
                    <div className="h-[1px] bg-white/5 my-1 mx-2" />
                    <button onClick={() => { saveAllFiles(); closeMenu(); }} className={itemClass}>
                         <div className={iconLabelClass}><IconSave size={14} className="text-vibe-text-muted group-hover:text-vibe-glow" /> <span>Save All</span></div>
                         <span className="text-[10px] opacity-40 font-mono">⌘S</span>
                    </button>
                    <button onClick={handleDownloadZip} className={itemClass}>
                         <div className={iconLabelClass}><IconDownload size={14} className="text-vibe-text-muted group-hover:text-vibe-glow" /> <span>Export as ZIP</span></div>
                    </button>

                    {recentProjects.length > 0 && (
                      <>
                        <div className="h-[1px] bg-white/5 my-1 mx-2" />
                        <div className="px-3 py-1.5 text-[10px] font-bold text-vibe-text-muted uppercase tracking-wider">Recent</div>
                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                          {recentProjects.map(proj => (
                            <div key={proj.id} className="group flex items-center justify-between px-1 transition-colors mx-1 rounded-lg hover:bg-white/5">
                                <button onClick={() => { handleLoadProject(proj); closeMenu(); }} className="flex-1 flex items-center gap-3 px-2 py-2 text-xs text-vibe-text-soft group-hover:text-vibe-text-main">
                                    <IconFolder size={14} className="text-vibe-text-muted group-hover:text-vibe-accent" />
                                    <span className="truncate">{proj.name}</span>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setProjectToDelete(proj); closeMenu(); }} className="p-2 rounded-lg text-vibe-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <IconTrash size={14}/>
                                </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                </div>
            )}
        </div>

        {/* Edit Menu */}
        <div className="relative h-full flex items-center">
            <button className={menuButtonClass('edit')} onClick={() => handleMenuClick('edit')}>Edit</button>
            {activeMenu === 'edit' && (
                <div className={dropdownClass}>
                    <button onClick={() => { undo(); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconUndo size={14} /> <span>Undo</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⌘Z</span>
                    </button>
                    <button onClick={() => { redo(); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconRedo size={14} /> <span>Redo</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⇧⌘Z</span>
                    </button>
                    <div className="h-[1px] bg-white/5 my-1 mx-2" />
                    <button onClick={() => { setIsCommandPaletteOpen(true); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconSearch size={14} /> <span>Search Anywhere</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⌘P</span>
                    </button>
                </div>
            )}
        </div>
        
        {/* View Menu */}
         <div className="relative h-full flex items-center">
            <button className={menuButtonClass('view')} onClick={() => handleMenuClick('view')}>View</button>
            {activeMenu === 'view' && (
                <div className={dropdownClass}>
                     <button onClick={() => { setActiveSidebarView(activeSidebarView ? null : 'explorer'); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconLayout size={14} /> <span>Toggle Sidebar</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⌘B</span>
                     </button>
                     <button onClick={() => { setIsTerminalOpen(!isTerminalOpen); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconTerminal size={14} /> <span>Toggle Terminal</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⌘J</span>
                     </button>
                     <button onClick={() => { setIsAIOpen(!isAIOpen); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconSparkles size={14} /> <span>Toggle AI Panel</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⌘L</span>
                     </button>
                     <button onClick={() => { setIsPreviewOpen(!isPreviewOpen); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconEye size={14} /> <span>Toggle Preview</span></div>
                     </button>
                     <div className="h-[1px] bg-white/5 my-1 mx-2" />
                     <button onClick={() => { setIsSettingsOpen(true); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconSettings size={14} /> <span>Settings</span></div>
                        <span className="text-[10px] opacity-40 font-mono">⌘,</span>
                     </button>
                </div>
            )}
        </div>

        {/* AI Hub Menu */}
        <div className="relative h-full flex items-center">
            <button className={menuButtonClass('ai')} onClick={() => handleMenuClick('ai')}>AI</button>
            {activeMenu === 'ai' && (
                <div className={dropdownClass}>
                    <div className="px-3 py-2 flex flex-col gap-1 mb-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Intelligence Status</span>
                        <div className="flex items-center gap-2 text-[10px]">
                            <div className={`w-2 h-2 rounded-full ${indexingStatus === 'indexing' ? 'bg-vibe-glow animate-pulse' : 'bg-green-500'}`}></div>
                            <span className="text-slate-300">{indexingStatus === 'indexing' ? 'Indexing Project...' : 'Codebase Aware'}</span>
                        </div>
                    </div>
                    <div className="h-[1px] bg-white/5 my-1 mx-2" />
                    <button onClick={() => { clearChat(); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconRefresh size={14} /> <span>Clear Context</span></div>
                    </button>
                    <button onClick={() => { setIsSettingsOpen(true); closeMenu(); }} className={itemClass}>
                        <div className={iconLabelClass}><IconBrain size={14} /> <span>Switch Model</span></div>
                    </button>
                </div>
            )}
        </div>

      </div>
      
      {/* Center Interactive Breadcrumb / Search Trigger */}
      <div className="flex-1 flex justify-center h-full">
         <button 
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-4 h-7 my-auto bg-black/20 hover:bg-black/40 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg border border-white/5 shadow-inner transition-all group max-w-sm w-full justify-center"
         >
             <IconSearch size={12} className="text-vibe-text-muted group-hover:text-vibe-glow transition-colors" />
             <div className="flex items-center gap-1.5 text-[11px] text-vibe-text-soft font-medium tracking-wide overflow-hidden">
                 <span className="opacity-60">{activeProject?.name || 'Vibe'}</span>
                 <span className="opacity-30">/</span>
                 <span className="truncate group-hover:text-vibe-text-main transition-colors">{activeFile?.name || 'Search...'}</span>
             </div>
             <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <kbd className="px-1 py-0 rounded bg-white/10 text-[9px] font-mono border border-white/10 text-vibe-text-muted">⌘P</kbd>
             </div>
         </button>
      </div>

      {/* Right Tools */}
      <div className="flex items-center gap-2">
        <div className="flex items-center px-2 py-1 bg-white/5 rounded-full border border-white/5 gap-2 mr-2">
            <div className={`w-1.5 h-1.5 rounded-full ${indexingStatus === 'indexing' ? 'bg-vibe-glow animate-pulse' : 'bg-vibe-glow/40'}`}></div>
            <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-500">Neural Link</span>
        </div>

        <Tooltip content={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} position="bottom">
            <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-vibe-text-muted hover:text-vibe-text-main bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label={`Switch Theme`}
            >
                {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default MenuBar;
