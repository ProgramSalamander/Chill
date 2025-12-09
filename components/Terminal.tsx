import React, { useRef, useEffect, useState } from 'react';
import { TerminalLine, Diagnostic } from '../types';
import { IconClose, IconSearch, IconTerminal } from './Icons';

interface TerminalProps {
  lines: TerminalLine[];
  isOpen: boolean;
  diagnostics?: Diagnostic[];
  onSelectDiagnostic?: (line: number, col: number) => void;
}

const Terminal: React.FC<TerminalProps> = ({ lines, isOpen, diagnostics = [], onSelectDiagnostic }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'terminal' | 'problems'>('terminal');

  useEffect(() => {
    if (isOpen && activeTab === 'terminal') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, isOpen, activeTab]);

  useEffect(() => {
    if (diagnostics.length > 0) {
      // Optional: Auto-switch to problems if new errors appear? 
      // Maybe simpler to just show a badge count.
    }
  }, [diagnostics]);

  if (!isOpen) return null;

  return (
    <div className="h-48 border-t border-white/10 bg-vibe-900 font-mono text-sm flex flex-col">
      <div className="flex items-center justify-between px-4 bg-vibe-800 border-b border-white/5 h-9 shrink-0">
        <div className="flex items-center h-full gap-6">
             <button 
                onClick={() => setActiveTab('terminal')}
                className={`h-full text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'terminal' ? 'text-white border-vibe-glow' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
             >
                <IconTerminal size={12} />
                Terminal
             </button>
             <button 
                onClick={() => setActiveTab('problems')}
                className={`h-full text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'problems' ? 'text-white border-red-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
             >
                <div className={`w-2 h-2 rounded-full ${diagnostics.length > 0 ? 'bg-red-500' : 'bg-slate-600'}`}></div>
                Problems {diagnostics.length > 0 && `(${diagnostics.length})`}
             </button>
        </div>
        <div className="flex gap-2">
           <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
           <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
           <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'terminal' ? (
            <div className="space-y-1">
                {lines.map((line) => (
                <div key={line.id} className="flex gap-2">
                    <span className="text-slate-600 select-none flex-shrink-0">
                    {new Date(line.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                    </span>
                    <span className={`
                    break-all whitespace-pre-wrap
                    ${line.type === 'error' ? 'text-red-400' : ''}
                    ${line.type === 'success' ? 'text-green-400' : ''}
                    ${line.type === 'command' ? 'text-yellow-400' : ''}
                    ${line.type === 'info' ? 'text-slate-300' : ''}
                    `}>
                    {line.type === 'command' && '$ '}
                    {line.text}
                    </span>
                </div>
                ))}
                <div ref={bottomRef} />
            </div>
        ) : (
            <div className="space-y-1">
                {diagnostics.length === 0 ? (
                    <div className="text-slate-500 italic">No problems detected.</div>
                ) : (
                    diagnostics.map((diag, idx) => (
                        <div 
                            key={idx} 
                            className="flex gap-3 hover:bg-white/5 p-1 rounded cursor-pointer group"
                            onClick={() => onSelectDiagnostic && onSelectDiagnostic(diag.startLine, diag.startColumn)}
                        >
                            <span className="text-red-500 flex-shrink-0">✖</span>
                            <div className="flex flex-col">
                                <span className="text-slate-300 text-xs">
                                    {diag.message} <span className="text-slate-600">({diag.code})</span>
                                </span>
                                <span className="text-slate-500 text-[10px] group-hover:text-vibe-glow transition-colors">
                                    Line {diag.startLine}, Col {diag.startColumn}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
