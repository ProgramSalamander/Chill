
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { IconClose } from './Icons';
import { useTerminalStore } from '../stores/terminalStore';
import { useUIStore } from '../stores/uiStore';
import { useFileTreeStore } from '../stores/fileStore';
import { selectActiveFile, selectIsTerminalOpen } from '../stores/selectors';

const Terminal: React.FC = () => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'terminal' | 'problems'>('terminal');
  
  const lines = useTerminalStore(state => state.lines);
  const diagnostics = useTerminalStore(state => state.diagnostics);
  
  const isTerminalOpen = useUIStore(selectIsTerminalOpen);
  const setIsTerminalOpen = useUIStore(state => state.setIsTerminalOpen);
  
  const selectFile = useFileTreeStore(state => state.selectFile);
  const activeFile = useFileTreeStore(selectActiveFile);

  useEffect(() => {
    if (isTerminalOpen && activeTab === 'terminal') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, isTerminalOpen, activeTab]);

  const handleSelectDiagnostic = (line: number, col: number) => {
    // If we have an active file, we ensure it's selected (active) in the editor
    if (activeFile) {
        selectFile(activeFile);
        // In a real editor we'd jump to line/col via monaco instance actions
    }
  };

  return (
    <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] glass-panel overflow-hidden ${isTerminalOpen ? 'h-56 shadow-2xl' : 'h-11 opacity-80 hover:opacity-100'}`}>
        <div className="h-full bg-black/40 backdrop-blur-xl font-mono text-sm flex flex-col">
          <div className="flex items-center justify-between px-5 bg-white/5 border-b border-white/5 h-11 shrink-0">
            <div className="flex items-center h-full gap-8">
                 <button 
                    onClick={() => setActiveTab('terminal')}
                    className={`h-full text-[10px] font-bold uppercase tracking-[0.1em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'terminal' ? 'text-vibe-glow border-vibe-accent' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                 >
                    Terminal
                 </button>
                 <button 
                    onClick={() => setActiveTab('problems')}
                    className={`h-full text-[10px] font-bold uppercase tracking-[0.1em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'problems' ? 'text-red-400 border-red-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                 >
                    <div className={`w-2 h-2 rounded-full ${diagnostics.length > 0 ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-slate-600'}`}></div>
                    Problems {diagnostics.length > 0 && `(${diagnostics.length})`}
                 </button>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsTerminalOpen(!isTerminalOpen)} 
                className="text-slate-500 hover:text-white transition-all p-1.5 rounded-lg hover:bg-white/5"
                title={isTerminalOpen ? "Close Terminal" : "Open Terminal"}
              >
                <IconClose size={16} className={`transition-transform duration-300 ${isTerminalOpen ? 'rotate-0' : 'rotate-180'}`} />
              </button>
            </div>
          </div>
          
          {isTerminalOpen && (
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-black/20">
                {activeTab === 'terminal' ? (
                    <div className="space-y-2 font-mono text-xs md:text-[13px]">
                        {lines.map((line) => (
                        <div key={line.id} className="flex gap-4 group">
                            <span className="text-slate-600 select-none flex-shrink-0 text-[10px] pt-1 opacity-40 group-hover:opacity-100 transition-opacity font-medium">
                            {new Date(line.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                            </span>
                            <span className={`
                            break-all whitespace-pre-wrap flex-1 leading-relaxed
                            ${line.type === 'error' ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.3)]' : ''}
                            ${line.type === 'success' ? 'text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.3)]' : ''}
                            ${line.type === 'command' ? 'text-vibe-glow font-semibold' : ''}
                            ${line.type === 'info' ? 'text-slate-300' : ''}
                            ${line.type === 'warning' ? 'text-orange-400' : ''}
                            `}>
                            {line.type === 'command' && <span className="text-slate-600 mr-2 opacity-50">❯</span>}
                            {line.text}
                            </span>
                        </div>
                        ))}
                        <div ref={bottomRef} className="h-4" />
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {diagnostics.length === 0 ? (
                            <div className="text-slate-500 italic flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/5">
                                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-[10px]">✓</div>
                                <span className="text-sm">Workspace is clean. System optimal.</span>
                            </div>
                        ) : (
                            diagnostics.map((diag, idx) => (
                                <div 
                                    key={idx} 
                                    className="flex gap-4 hover:bg-white/5 p-3 rounded-xl cursor-pointer group border border-transparent hover:border-red-500/20 transition-all bg-black/10"
                                    onClick={() => handleSelectDiagnostic(diag.startLine, diag.startColumn)}
                                >
                                    <span className="text-red-500 flex-shrink-0 mt-0.5 text-lg">×</span>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-200 text-sm font-medium truncate">
                                                {diag.message}
                                            </span>
                                            <span className="text-slate-600 font-mono text-[10px] opacity-50 group-hover:opacity-100 transition-opacity shrink-0 ml-2">{diag.code}</span>
                                        </div>
                                        <span className="text-slate-500 text-[10px] group-hover:text-vibe-glow transition-colors mt-1 font-mono">
                                            L{diag.startLine}, Col {diag.startColumn}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
              </div>
          )}
        </div>
    </div>
  );
};

export default Terminal;
