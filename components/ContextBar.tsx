import React from 'react';
import { IconSparkles, IconBug, IconFileText, IconWand, IconFileCode } from './Icons';

interface ContextBarProps {
  language: string;
  onAction: (action: string) => void;
}

const ContextBar: React.FC<ContextBarProps> = ({ language, onAction }) => {
  return (
    <div className="flex items-center p-1 bg-[#0f0f16]/80 backdrop-blur-xl border border-vibe-accent/20 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.6)] ring-1 ring-white/5 animate-in fade-in slide-in-from-top-4 zoom-in-95 duration-200">
       <div className="px-3 py-1.5 text-xs font-bold text-vibe-glow border-r border-white/5 flex items-center gap-2 select-none">
          <IconSparkles size={14} className="text-vibe-accent animate-pulse-slow" />
          <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">AI Lens</span>
       </div>
       
       <div className="flex items-center gap-0.5 pl-1">
            <button 
                onClick={() => onAction('explain')} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all hover:scale-105"
                title="Explain Selection"
            >
                Explain
            </button>
            
            <button 
                onClick={() => onAction('refactor')} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all hover:scale-105 group"
                title="Refactor Code"
            >
                <IconWand size={12} className="group-hover:text-vibe-accent transition-colors" />
                Refactor
            </button>
            
            <button 
                onClick={() => onAction('debug')} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all hover:scale-105 group"
                title="Find Bugs"
            >
                <IconBug size={12} className="group-hover:text-red-400 transition-colors" />
                Fix
            </button>
            
            <button 
                onClick={() => onAction('docs')} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all hover:scale-105 group"
                title="Add Documentation"
            >
                <IconFileText size={12} className="group-hover:text-green-400 transition-colors" />
                Docs
            </button>

            {(language === 'typescript' || language === 'javascript' || language === 'python' || language === 'tsx') && (
                <button 
                    onClick={() => onAction('types')} 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all hover:scale-105 group"
                    title={language === 'python' ? 'Add Type Hints' : 'Add Types'}
                >
                    <IconFileCode size={12} className="group-hover:text-blue-400 transition-colors" />
                    Types
                </button>
            )}
       </div>
    </div>
  );
}

export default ContextBar;