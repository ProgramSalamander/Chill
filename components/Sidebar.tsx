import React, { useState, useRef, useEffect, useMemo } from 'react';
import { IconSearch, IconSettings, IconMore, IconEyeOff, IconEye, IconFolderOpen, IconZap } from './Icons';
import { SidebarView } from '../types';
import FileExplorer from './FileExplorer';
import GitPanel from './GitPanel';
import ExtensionsPanel from './ExtensionsPanel';
import Tooltip from './Tooltip';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';

const Sidebar: React.FC = () => {
  const activeSidebarView = useUIStore(state => state.activeSidebarView);
  const setActiveSidebarView = useUIStore(state => state.setActiveSidebarView);
  const sidebarViews = useUIStore(state => state.sidebarViews);
  const updateSidebarViews = useUIStore(state => state.updateSidebarViews);
  const setIsCommandPaletteOpen = useUIStore(state => state.setIsCommandPaletteOpen);
  const setIsSettingsOpen = useUIStore(state => state.setIsSettingsOpen);

  const gitStatus = useGitStore(state => state.status);

  const visibleSortedViews = useMemo(() => 
    sidebarViews.filter(v => v.visible).sort((a,b) => a.order - b.order), 
    [sidebarViews]
  );
  
  // --- ACTIVITY BAR STATE & LOGIC ---
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, opacity: 0 });
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, view: SidebarView } | null>(null);
  const [hiddenMenuOpen, setHiddenMenuOpen] = useState(false);
  const hiddenMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeIndex = visibleSortedViews.findIndex(v => v.id === activeSidebarView);
    if (activeIndex !== -1) {
      const activeIcon = iconRefs.current[activeIndex];
      if (activeIcon) {
        setIndicatorStyle({
          top: activeIcon.offsetTop,
          opacity: 1,
        });
      }
    } else {
       setIndicatorStyle({ top: indicatorStyle.top, opacity: 0 });
    }
  }, [activeSidebarView, visibleSortedViews]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hiddenMenuRef.current && !hiddenMenuRef.current.contains(event.target as Node)) { setHiddenMenuOpen(false); }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) { setContextMenu(null); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragStart = (e: React.DragEvent, view: SidebarView) => {
    e.dataTransfer.setData('text/plain', view.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(view.id);
  };
  
  const handleDragOver = (e: React.DragEvent, view: SidebarView) => {
    e.preventDefault();
    if (view.id !== dragOverId) { setDragOverId(view.id); }
  };

  const handleDrop = (e: React.DragEvent, targetView: SidebarView) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    setDraggedId(null); setDragOverId(null);
    if (sourceId === targetView.id) return;

    const visibleIds = visibleSortedViews.map(v => v.id);
    const sourceIndex = visibleIds.indexOf(sourceId);
    
    const [movedId] = visibleIds.splice(sourceIndex, 1);
    const targetIndex = visibleIds.indexOf(targetView.id);
    visibleIds.splice(targetIndex, 0, movedId);

    const hidden = sidebarViews.filter(v => !v.visible).sort((a,b) => a.order - b.order);
    const newVisible = visibleIds.map(id => sidebarViews.find(v => v.id === id)!);
    const finalViews = [...newVisible, ...hidden].map((view, index) => ({...view, order: index}));

    updateSidebarViews(finalViews);
  };

  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };
  const handleContextMenu = (e: React.MouseEvent, view: SidebarView) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, view }); };
  
  const handleHide = () => {
    if (!contextMenu) return;
    if (contextMenu.view.id === activeSidebarView) { setActiveSidebarView(null); }
    const newViews = sidebarViews.map(v => v.id === contextMenu.view.id ? { ...v, visible: false } : v);
    updateSidebarViews(newViews);
    setContextMenu(null);
  };

  const handleShow = (id: string) => {
    const newViews = sidebarViews.map(v => v.id === id ? { ...v, visible: true } : v);
    updateSidebarViews(newViews);
  };

  const hiddenViews = sidebarViews.filter(v => !v.visible).sort((a,b) => a.order - b.order);

  return (
    <div className="flex gap-3 h-full">
        {/* Activity Bar */}
        <div className="w-14 flex flex-col items-center py-4 gap-4 z-40 rounded-2xl glass-panel shadow-lg shrink-0 h-full">
            <div 
              className="w-full flex flex-col items-center gap-4 relative" 
              onDragLeave={() => setDragOverId(null)}
            >
              <div 
                 className="absolute left-0 w-1 h-11 bg-vibe-accent rounded-r-full shadow-[0_0_15px_rgba(129,140,248,0.7)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                 style={indicatorStyle}
              />
              {visibleSortedViews.map((view, index) => {
                const isActive = activeSidebarView === view.id;
                const hasGitBadge = view.id === 'git' && gitStatus.filter(s => s.status !== 'unmodified').length > 0;
                const isDragged = draggedId === view.id;
                const isDragOver = dragOverId === view.id;

                return (
                  <Tooltip key={view.id} content={view.title} shortcut={view.id === 'explorer' ? '⌘B' : undefined}>
                    <div
                      ref={el => { iconRefs.current[index] = el; }}
                      draggable
                      onDragStart={e => handleDragStart(e, view)}
                      onDragOver={e => handleDragOver(e, view)}
                      onDrop={e => handleDrop(e, view)}
                      onDragEnd={handleDragEnd}
                      onContextMenu={e => handleContextMenu(e, view)}
                      onClick={() => setActiveSidebarView(isActive ? null : view.id)}
                      className={`p-3 rounded-xl transition-all duration-300 relative group w-[44px] h-[44px] flex items-center justify-center cursor-pointer
                        ${isActive ? 'bg-vibe-accent/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}
                        ${isDragged ? 'opacity-30 scale-90' : 'opacity-100 scale-100'}
                        ${isDragOver ? 'bg-white/10' : ''}
                      `}
                      id={`sidebar-${view.id}-button`}
                    >
                      <div className="relative z-10">
                        <view.icon size={20} strokeWidth={1.5} />
                        {hasGitBadge && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-vibe-900 shadow-sm animate-pulse"></div>
                        )}
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>

            <Tooltip content="Command Palette" shortcut="⌘P">
              <button 
                onClick={() => setIsCommandPaletteOpen(true)}
                className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-105"
              >
                <IconSearch size={20} strokeWidth={1.5} />
              </button>
            </Tooltip>
            
            <div className="w-8 h-[1px] bg-white/10 my-1"></div>
            
            <Tooltip content="Settings">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300 hover:rotate-90"
              >
                <IconSettings size={20} strokeWidth={1.5} />
              </button>
            </Tooltip>
            
            <div className="relative mt-auto pt-4" ref={hiddenMenuRef}>
              <Tooltip content="Manage Views" position="top">
                <button
                  onClick={() => setHiddenMenuOpen(p => !p)}
                  className={`p-2 rounded-full transition-colors ${hiddenMenuOpen ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <IconMore size={16} />
                </button>
              </Tooltip>
              {hiddenMenuOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-[#0f0f16]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Hidden Views
                  </div>
                  {hiddenViews.length > 0 ? hiddenViews.map(view => (
                    <button 
                      key={view.id}
                      onClick={() => handleShow(view.id)}
                      className="group px-3 py-2 text-xs text-left text-slate-300 hover:bg-vibe-accent/20 hover:text-white flex items-center gap-3 transition-colors mx-1 rounded-lg"
                    >
                      <IconEye size={14} className="text-slate-500 group-hover:text-vibe-glow" />
                      <span>{view.title.split('(')[0].trim()}</span>
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-xs text-slate-600 italic">None</div>
                  )}
                </div>
              )}
            </div>

            {contextMenu && (
              <div 
                ref={contextMenuRef}
                style={{ top: contextMenu.y, left: contextMenu.x + 10 }}
                className="fixed z-50 w-32 bg-[#0f0f16]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50"
              >
                <button 
                  onClick={handleHide}
                  className="group px-3 py-2 text-xs text-left text-slate-300 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors mx-1 rounded-lg"
                >
                  <IconEyeOff size={14} className="text-slate-500 group-hover:text-red-400" />
                  <span>Hide</span>
                </button>
              </div>
            )}
        </div>
        
        {/* Content Panel */}
        {activeSidebarView && (
            <div className="w-64 glass-panel rounded-2xl flex flex-col animate-in slide-in-from-left-4 duration-300 h-full overflow-hidden shadow-2xl">
               {activeSidebarView === 'explorer' && <FileExplorer />}
               {activeSidebarView === 'git' && <GitPanel />}
               {activeSidebarView === 'extensions' && <ExtensionsPanel />}
            </div>
        )}
    </div>
  );
};

export default Sidebar;
