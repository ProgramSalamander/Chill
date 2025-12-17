import React, { useRef, useEffect, useState } from 'react';
import { IconClose } from './Icons';
import { useTerminalStore } from '../stores/terminalStore';
import { useUIStore } from '../stores/uiStore';
import { useFileTreeStore } from '../stores/fileStore';

const Terminal: React.FC = () => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'terminal' | 'problems'>('terminal');
  
  const lines = useTerminalStore(state => state.lines);
  const diagnostics = useTerminalStore(state => state.diagnostics);
  const isTerminalOpen = useUIStore(state => state.isTerminalOpen);
  const setIsTerminalOpen = useUIStore(state => state.setIsTerminalOpen);
  const selectFile = useFileTreeStore(state => state.selectFile);

  useEffect(() => {
    if (isTerminalOpen && activeTab === 'terminal') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, isTerminalOpen, activeTab]);

  const handleSelectDiagnostic = (line: number, col: number) => {
    // For now, this just selects the active file, assuming diagnostics are for it.
    // A more complex implementation would find the file associated with the diagnostic.
    // FIX: The `activeFile` property does not exist on the file store state. It must be derived from `files` and `activeFileId`.
    const { files, activeFileId } = useFileTreeStore.getState();
    const activeFile = files.find(f => f.id === activeFileId);
    if (activeFile) {
        selectFile(activeFile);
        // We'd also need to tell the editor to jump to this line/col.
        // This can be done via another state/event system if needed.
    }
  };

  return (
    <div className={`transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] glass-panel rounded-2xl overflow-hidden ${isTerminalOpen ? 'h-48 shadow-xl' : 'h-10 opacity-80 hover:opacity-100'}`}>
        <div className="h-full bg-black/40 backdrop-blur-sm font-mono text-sm flex flex-col">
          <div className="flex items-center justify-between px-4 bg-white/5 border-b border-white/5 h-10 shrink-0">
            <div className="flex items-center h-full gap-6">
                 <button 
                    onClick={() => setActiveTab('terminal')}
                    className={`h-full text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'terminal' ? 'text-vibe-glow border-vibe-accent' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                 >
                    Terminal
                 </button>
                 <button 
                    onClick={() => setActiveTab('problems')}
                    className={`h-full text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'problems' ? 'text-red-400 border-red-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                 >
                    <div className={`w-2 h-2 rounded-full ${diagnostics.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></div>
                    Problems {diagnostics.length > 0 && `(${diagnostics.length})`}
                 </button>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className="text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                <IconClose size={16} />
              </button>
            </div>
          </div>
          
          {isTerminalOpen && (
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'terminal' ? (
                    <div className="space-y-1.5 font-mono text-xs md:text-sm">
                        {lines.map((line) => (
                        <div key={line.id} className="flex gap-3 group">
                            <span className="text-slate-600 select-none flex-shrink-0 text-[10px] pt-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                            {new Date(line.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                            </span>
                            <span className={`
                            break-all whitespace-pre-wrap flex-1
                            ${line.type === 'error' ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]' : ''}
                            ${line.type === 'success' ? 'text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]' : ''}
                            ${line.type === 'command' ? 'text-yellow-400 font-semibold' : ''}
                            ${line.type === 'info' ? 'text-slate-300' : ''}
                            ${line.type === 'warning' ? 'text-orange-400' : ''}
                            `}>
                            {line.type === 'command' && <span className="text-slate-500 mr-2">$</span>}
                            {line.text}
                            </span>
                        </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                ) : (
                    <div className="space-y-1">
                        {diagnostics.length === 0 ? (
                            <div className="text-slate-500 italic flex items-center gap-2">
                                <span className="text-green-500">✓</span> No problems detected. System optimal.
                            </div>
                        ) : (
                            diagnostics.map((diag, idx) => (
                                <div 
                                    key={idx} 
                                    className="flex gap-3 hover:bg-white/5 p-2 rounded cursor-pointer group border border-transparent hover:border-red-500/20 transition-all"
                                    onClick={() => handleSelectDiagnostic(diag.startLine, diag.startColumn)}
                                >
                                    <span className="text-red-500 flex-shrink-0 mt-0.5">✖</span>
                                    <div className="flex flex-col">
                                        <span className="text-slate-200 text-xs font-medium">
                                            {diag.message} <span className="text-slate-500 font-mono ml-2 opacity-50">{diag.code}</span>
                                        </span>
                                        <span className="text-slate-500 text-[10px] group-hover:text-vibe-glow transition-colors mt-1">
                                            Line {diag.startLine}, Col {diag.startColumn}
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