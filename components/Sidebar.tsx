
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { IconSearch, IconSettings } from './Icons';
import { SidebarView } from '../types';
import FileExplorer from './FileExplorer';
import GitPanel from './GitPanel';
import ExtensionsPanel from './ExtensionsPanel';
import ChangesReviewPanel from './ChangesReviewPanel';
import UsagePanel from './UsagePanel';
import SearchPanel from './SearchPanel';
import Tooltip from './Tooltip';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';
import { useAgentStore } from '../stores/agentStore';

const Sidebar: React.FC = () => {
  const activeSidebarView = useUIStore(state => state.activeSidebarView);
  const setActiveSidebarView = useUIStore(state => state.setActiveSidebarView);
  const sidebarViews = useUIStore(state => state.sidebarViews);
  const updateSidebarViews = useUIStore(state => state.updateSidebarViews);
  const sidebarWidth = useUIStore(state => state.sidebarWidth);
  const setSidebarWidth = useUIStore(state => state.setSidebarWidth);
  const setIsCommandPaletteOpen = useUIStore(state => state.setIsCommandPaletteOpen);
  const setIsSettingsOpen = useUIStore(state => state.setIsSettingsOpen);
  const setIsDraggingSidebar = useUIStore(state => state.setIsDraggingSidebar);

  const gitStatus = useGitStore(state => state.status);
  const patchesCount = useAgentStore(state => state.patches.length);

  const visibleSortedViews = useMemo(() => 
    sidebarViews.filter(v => v.visible).sort((a,b) => a.order - b.order), 
    [sidebarViews]
  );
  
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, opacity: 0 });
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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
  }, [activeSidebarView, visibleSortedViews, draggedId]); // Added draggedId to refresh during layout shifts

  const handleDragStart = (e: React.DragEvent, view: SidebarView) => {
    e.dataTransfer.setData('text/plain', view.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(view.id);
    setIsDraggingSidebar(true);
    
    // Set a custom drag image if desired, or just rely on CSS opacity
    const dragElement = e.currentTarget as HTMLElement;
    dragElement.style.opacity = '0.4';
  };
  
  const handleDragOver = (e: React.DragEvent, view: SidebarView) => {
    e.preventDefault();
    if (view.id !== dragOverId) { 
        setDragOverId(view.id);
        
        // Premium behavior: If we hover over a different item, preview the swap immediately
        const sourceId = draggedId;
        if (sourceId && sourceId !== view.id) {
            const visibleIds = visibleSortedViews.map(v => v.id);
            const sourceIndex = visibleIds.indexOf(sourceId);
            const targetIndex = visibleIds.indexOf(view.id);
            
            const newIds = [...visibleIds];
            const [moved] = newIds.splice(sourceIndex, 1);
            newIds.splice(targetIndex, 0, moved);
            
            const hidden = sidebarViews.filter(v => !v.visible);
            const newVisible = newIds.map(id => sidebarViews.find(v => v.id === id)!);
            const finalViews = [...newVisible, ...hidden].map((v, i) => ({...v, order: i}));
            updateSidebarViews(finalViews);
        }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedId(null); 
    setDragOverId(null);
    setIsDraggingSidebar(false);
  };

  const handleDragEnd = (e: React.DragEvent) => { 
    setDraggedId(null); 
    setDragOverId(null);
    setIsDraggingSidebar(false);
    const dragElement = e.currentTarget as HTMLElement;
    dragElement.style.opacity = '1';
  };

  // --- Resizing Logic ---
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + deltaX;
      const clampedWidth = Math.max(200, Math.min(newWidth, 500));
      setSidebarWidth(clampedWidth);
  }, [setSidebarWidth]);

  const handleMouseUp = useCallback(() => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, handleMouseMove, handleMouseUp]);

  useEffect(() => {
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="flex gap-0 h-full">
        {/* Activity Bar */}
        <div className="w-14 flex flex-col items-center py-4 gap-4 z-40 rounded-2xl glass-panel shadow-lg shrink-0 h-full mr-3 border-vibe-border">
            <div 
              className="w-full flex flex-col items-center gap-4 relative" 
              onDragLeave={() => setDragOverId(null)}
            >
              <div 
                 className="absolute left-0 w-1 h-11 bg-vibe-accent rounded-r-full shadow-[0_0_15px_rgba(129,140,248,0.7)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none"
                 style={indicatorStyle}
              />
              {visibleSortedViews.map((view, index) => {
                const isActive = activeSidebarView === view.id;
                const hasGitBadge = view.id === 'git' && gitStatus.filter(s => s.status !== 'unmodified').length > 0;
                const hasChangesBadge = view.id === 'changes' && patchesCount > 0;
                const isDragged = draggedId === view.id;
                const isDragOver = dragOverId === view.id;

                return (
                  <Tooltip key={view.id} content={view.title} shortcut={view.id === 'explorer' ? '⌘B' : undefined}>
                    <div
                      ref={el => { iconRefs.current[index] = el; }}
                      draggable
                      onDragStart={e => handleDragStart(e, view)}
                      onDragOver={e => handleDragOver(e, view)}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      onClick={() => setActiveSidebarView(isActive ? null : view.id)}
                      className={`p-3 rounded-xl transition-all duration-300 relative group w-[44px] h-[44px] flex items-center justify-center cursor-pointer
                        ${isActive ? 'bg-vibe-accent/20 text-vibe-accent dark:text-white' : 'text-vibe-text-soft hover:text-vibe-text-main hover:bg-black/5 dark:hover:bg-white/10'}
                        ${isDragged ? 'opacity-20 scale-90 grayscale shadow-inner' : 'opacity-100 scale-100'}
                        ${isDragOver ? 'bg-indigo-500/10 scale-110 shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]' : ''}
                      `}
                      id={`sidebar-${view.id}-button`}
                    >
                      <div className="relative z-10 pointer-events-none">
                        <view.icon size={20} strokeWidth={1.5} />
                        {hasGitBadge && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-vibe-900 shadow-sm animate-pulse"></div>
                        )}
                        {hasChangesBadge && (
                          <div className="absolute top-0 right-0 w-4 h-4 bg-vibe-accent rounded-full border-2 border-vibe-900 text-[9px] flex items-center justify-center text-white font-bold shadow-md">
                            {patchesCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>

            <div className="flex-1" />

            <Tooltip content="Spotlight" shortcut="⌘P">
              <button 
                onClick={() => setIsCommandPaletteOpen(true)}
                className="p-3 rounded-xl text-vibe-text-soft hover:text-vibe-text-main hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300 hover:scale-105"
              >
                <IconSearch size={20} strokeWidth={1.5} />
              </button>
            </Tooltip>
            
            <div className="w-8 h-[1px] bg-vibe-border my-1"></div>
            
            <Tooltip content="Settings">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 rounded-xl text-vibe-text-soft hover:text-vibe-text-main hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300 hover:rotate-90"
              >
                <IconSettings size={20} strokeWidth={1.5} />
              </button>
            </Tooltip>
        </div>
        
        {/* Content Panel */}
        {activeSidebarView && (
            <div className="flex animate-in slide-in-from-left-4 duration-300">
                <div 
                  style={{ width: `${sidebarWidth}px` }}
                  className="glass-panel rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl shrink-0 border-vibe-border"
                >
                   {activeSidebarView === 'explorer' && <FileExplorer />}
                   {activeSidebarView === 'search' && <SearchPanel />}
                   {activeSidebarView === 'git' && <GitPanel />}
                   {activeSidebarView === 'extensions' && <ExtensionsPanel />}
                   {activeSidebarView === 'changes' && <ChangesReviewPanel />}
                   {activeSidebarView === 'usage' && <UsagePanel />}
                </div>
                <div
                    onMouseDown={handleMouseDown}
                    className="w-1.5 h-full cursor-col-resize group flex items-center justify-center"
                    title="Resize Sidebar"
                >
                    <div className="w-0.5 h-10 bg-vibe-border rounded-full group-hover:bg-vibe-accent transition-colors duration-200"></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Sidebar;
