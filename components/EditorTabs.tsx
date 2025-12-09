
import React from 'react';
import { File, Diagnostic } from '../types';
import { IconFileCode, IconClose, IconEye, IconEyeOff, IconPlay, IconSparkles } from './Icons';

interface EditorTabsProps {
  openFileIds: string[];
  activeFileId: string;
  files: File[];
  setActiveFileId: (id: string) => void;
  onCloseTab: (e: React.MouseEvent, id: string) => void;
  onClearSelection: () => void;
  isPreviewOpen: boolean;
  setIsPreviewOpen: (v: boolean) => void;
  isAIOpen: boolean;
  setIsAIOpen: (v: boolean) => void;
  onRunCode: () => void;
}

const EditorTabs: React.FC<EditorTabsProps> = ({
  openFileIds,
  activeFileId,
  files,
  setActiveFileId,
  onCloseTab,
  onClearSelection,
  isPreviewOpen,
  setIsPreviewOpen,
  isAIOpen,
  setIsAIOpen,
  onRunCode
}) => {
  return (
    <div className="h-14 flex items-center justify-between glass-panel rounded-2xl px-3 select-none z-20">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[calc(100%-250px)]">
          {openFileIds.map(id => {
              const file = files.find(f => f.id === id);
              if (!file) return null;
              const isActive = activeFileId === id;
              return (
              <div 
                  key={id}
                  onClick={() => { setActiveFileId(id); onClearSelection(); }}
                  className={`
                      group flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer border transition-all min-w-[140px] max-w-[220px]
                      ${isActive 
                          ? 'bg-vibe-accent/20 border-vibe-accent/30 text-white shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                          : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10 hover:text-slate-300'}
                  `}
              >
                  <span className={`${isActive ? 'text-vibe-glow' : 'opacity-50'}`}>
                      {file.language === 'python' ? '🐍' : <IconFileCode size={14} />}
                  </span>
                  <span className="text-xs truncate flex-1 font-medium">{file.name}</span>
                  {file.isModified && <div className="w-1.5 h-1.5 rounded-full bg-vibe-accent animate-pulse"></div>}
                  <button 
                      onClick={(e) => onCloseTab(e, id)}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/20 rounded-md ${isActive ? 'text-slate-300 hover:text-white' : ''}`}
                  >
                      <IconClose size={12} />
                  </button>
              </div>
              )
          })}
      </div>

      <div className="flex items-center gap-2 pl-2 border-l border-vibe-border">
          <button 
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isPreviewOpen ? 'bg-vibe-accent text-white shadow-lg shadow-vibe-accent/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
              {isPreviewOpen ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              <span className="hidden sm:inline">Preview</span>
          </button>
          <button 
              onClick={onRunCode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all text-xs font-semibold hover:shadow-[0_0_10px_rgba(74,222,128,0.2)]"
          >
              <IconPlay size={14} />
              <span className="hidden sm:inline">Run</span>
          </button>
          <button 
              onClick={() => setIsAIOpen(!isAIOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold border ${isAIOpen ? 'bg-vibe-glow/20 text-vibe-glow border-vibe-glow/30 shadow-[0_0_15px_rgba(199,210,254,0.15)]' : 'bg-white/5 text-slate-400 border-transparent hover:text-white hover:bg-white/10'}`}
          >
              <IconSparkles size={14} />
              <span className="hidden sm:inline">AI Vibe</span>
          </button>
      </div>
    </div>
  );
};

export default EditorTabs;
