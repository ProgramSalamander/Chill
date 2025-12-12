import React, { useEffect, useRef, useState } from 'react';
import { IconSparkles, IconZap } from './Icons';

interface InlineInputProps {
  position: { top: number; left: number; lineHeight: number } | null;
  onClose: () => void;
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

export const InlineInput: React.FC<InlineInputProps> = ({ position, onClose, onSubmit, isProcessing }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on mount
    if (position) {
        setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [position]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) onSubmit(input);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!position) return null;

  return (
    <div 
      className="absolute z-50 flex flex-col gap-1 w-[400px] animate-in fade-in zoom-in-95 duration-200 origin-top-left"
      style={{ 
        top: position.top + position.lineHeight + 4, 
        left: Math.max(20, Math.min(position.left, window.innerWidth - 450)) // Clamp to screen
      }}
    >
        <div className="flex items-center gap-2 p-1 pl-3 bg-[#0f0f16]/90 backdrop-blur-xl border border-vibe-accent/30 rounded-full shadow-[0_0_30px_rgba(99,102,241,0.25)] ring-1 ring-white/10">
            <IconSparkles size={16} className={`text-vibe-accent flex-shrink-0 ${isProcessing ? 'animate-spin-slow' : ''}`} />
            <input 
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isProcessing ? "Generating..." : "Edit or generate code..."}
                className="bg-transparent border-none outline-none text-sm text-white flex-1 h-8 placeholder-slate-500 font-sans"
                disabled={isProcessing}
            />
            <div className="flex items-center pr-1 gap-1">
                <button 
                  onClick={() => input.trim() && onSubmit(input)}
                  disabled={isProcessing}
                  className="p-1.5 rounded-full bg-vibe-accent/20 text-vibe-glow hover:bg-vibe-accent hover:text-white transition-all disabled:opacity-50"
                >
                    <IconZap size={14} />
                </button>
            </div>
        </div>
        <div className="px-4 text-[10px] text-slate-500 font-medium drop-shadow-md">
            <span className="bg-black/40 px-1 rounded text-slate-400">Esc</span> to cancel • <span className="bg-black/40 px-1 rounded text-slate-400">Enter</span> to run
        </div>
    </div>
  );
};
