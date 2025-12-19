
import React from 'react';
import { IconFileCode, IconClose, IconEye, IconEyeOff, IconPlay, IconBrain, IconRefresh, IconArrowRight, IconTrash } from './Icons';
import Tooltip from './Tooltip';
import { useFileTreeStore } from '../stores/fileStore';
import { useUIStore } from '../stores/uiStore';

interface EditorTabsProps {
  onClearSelection: () => void;
  onRunCode: () => void;
  hasActiveFile: boolean;
}

const EditorTabs: React.FC<EditorTabsProps> = ({
  onClearSelection,
  onRunCode,
  hasActiveFile
}) => {
  const openFileIds = useFileTreeStore(state => state.openFileIds);
  const activeFileId = useFileTreeStore(state => state.activeFileId);
  const files = useFileTreeStore(state => state.files);
  const setActiveFileId = useFileTreeStore(state => state.setActiveFileId);
  const closeFile = useFileTreeStore(state => state.closeFile);
  const isPreviewOpen = useUIStore(state => state.isPreviewOpen);
  const setIsPreviewOpen = useUIStore(state => state.setIsPreviewOpen);
  const isAIOpen = useUIStore(state => state.isAIOpen);
  const setIsAIOpen = useUIStore(state => state.setIsAIOpen);
  const showContextMenu = useUIStore(state => state.showContextMenu);

  const handleTabContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    showContextMenu(e.clientX, e.clientY, [
      { id: 'close', label: 'Close', icon: <IconClose size={14}/>, onClick: () => closeFile(id) },
      { id: 'close-others', label: 'Close Others', icon: <IconRefresh size={14}/>, onClick: () => {
          openFileIds.forEach(fid => { if (fid !== id) closeFile(fid); });
      }},
      { id: 'close-all', label: 'Close All', icon: <IconRefresh size={14}/>, onClick: () => {
          openFileIds.forEach(fid => closeFile(fid));
      }},
      { id: 'sep1', label: '', variant: 'separator', onClick: () => {} },
      { id: 'reveal', label: 'Reveal in Explorer', icon: <IconArrowRight size={14}/>, onClick: () => {
          const file = files.find(f => f.id === id);
          if (file) {
              useUIStore.getState().setActiveSidebarView('explorer');
          }
      }},
      { id: 'sep2', label: '', variant: 'separator', onClick: () => {} },
      { id: 'delete', label: 'Delete File', variant: 'danger', icon: <IconTrash size={14}/>, onClick: () => {
          const file = files.find(f => f.id === id);
          if (file) {
              useFileTreeStore.getState().setFileToDelete(file);
          }
      }},
    ]);
  };

  return (
    <div className="h-14 flex items-center justify-between glass-panel rounded-2xl px-3 select-none z-20 border-vibe-border">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[calc(100%-250px)]">
          {openFileIds.map(id => {
              const file = files.find(f => f.id === id);
              if (!file) return null;
              const isActive = activeFileId === id;
              return (
              <div 
                  key={id}
                  onClick={() => { setActiveFileId(id); onClearSelection(); }}
                  onContextMenu={(e) => handleTabContextMenu(e, id)}
                  className={`
                      group flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer border transition-all min-w-[140px] max-w-[220px]
                      ${isActive 
                          ? 'bg-vibe-accent/20 border-vibe-accent/30 text-vibe-text-main shadow-[0_0_10px_rgba(99,102,241,0.1)]' 
                          : 'bg-black/5 dark:bg-white/5 border-transparent text-vibe-text-soft hover:bg-black/10 dark:hover:bg-white/10 hover:text-vibe-text-main'}
                  `}
              >
                  <span className={`${isActive ? 'text-vibe-glow' : 'opacity-50'}`}>
                      {file.language === 'python' ? '🐍' : <IconFileCode size={14} />}
                  </span>
                  <span className="text-xs truncate flex-1 font-medium">{file.name}</span>
                  {file.isModified && <div className="w-1.5 h-1.5 rounded-full bg-vibe-accent animate-pulse"></div>}
                  <button 
                      onClick={(e) => { e.stopPropagation(); closeFile(id); }}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 dark:hover:bg-white/20 rounded-md ${isActive ? 'text-vibe-text-soft hover:text-vibe-text-main' : ''}`}
                  >
                      <IconClose size={12} />
                  </button>
              </div>
              )
          })}
      </div>

      <div className="flex items-center gap-2 pl-2 border-l border-vibe-border">
          {hasActiveFile && (
            <>
              <Tooltip content={isPreviewOpen ? "Hide Preview" : "Show Live Preview"} position="bottom">
                <button 
                    onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isPreviewOpen ? 'bg-vibe-accent text-white shadow-lg shadow-vibe-accent/20' : 'text-vibe-text-soft hover:text-vibe-text-main hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                    {isPreviewOpen ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    <span className="hidden lg:inline">Preview</span>
                </button>
              </Tooltip>
              <Tooltip content="Run Code" position="bottom">
                <button 
                    onClick={onRunCode}
                    disabled={!hasActiveFile}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all text-xs font-semibold hover:shadow-[0_0_10px_rgba(74,222,128,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                    <IconPlay size={14} />
                    <span className="hidden lg:inline">Run</span>
                </button>
              </Tooltip>
            </>
          )}
          <Tooltip content={isAIOpen ? "Close AI Panel" : "Open AI Panel"} position="bottom">
            <button 
                onClick={() => setIsAIOpen(!isAIOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold border ${isAIOpen ? 'bg-vibe-glow/20 text-vibe-glow border-vibe-glow/30 shadow-[0_0_15px_rgba(199,210,254,0.1)]' : 'bg-black/5 dark:bg-white/5 text-vibe-text-soft border-transparent hover:text-vibe-text-main hover:bg-black/10 dark:hover:bg-white/10'}`}
            >
                <IconBrain size={14} />
                <span className="hidden xl:inline">AI Assistant</span>
            </button>
          </Tooltip>
      </div>
    </div>
  );
};

export default EditorTabs;
