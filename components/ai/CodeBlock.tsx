import React, { useState } from 'react';
import { IconCheck, IconCopy, IconInsert, IconZap } from '../Icons';

interface CodeBlockProps {
  code: string;
  language: string;
  onApply: (code: string) => void;
  onInsert: (code: string) => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ 
  code, 
  language, 
  onApply,
  onInsert
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-lg">
        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 text-xs text-slate-400">
            <span className="font-mono text-vibe-glow font-bold opacity-80">{language || 'text'}</span>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={handleCopy} 
                  className="flex items-center justify-center p-1.5 hover:bg-white/10 rounded-md transition-colors"
                  title="Copy to Clipboard"
                >
                    {copied ? <IconCheck size={14} className="text-green-400" /> : <IconCopy size={14} />}
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-1" />
                <button 
                  onClick={() => onInsert(code)}
                  className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md transition-colors text-slate-300 hover:text-white"
                  title="Insert at Cursor"
                >
                    <IconInsert size={14} />
                    <span>Insert</span>
                </button>
                <button 
                  onClick={() => onApply(code)}
                  className="flex items-center gap-1 px-2 py-1 hover:bg-vibe-accent/20 rounded-md transition-colors text-vibe-accent hover:text-indigo-300"
                  title="Replace Entire File Content"
                >
                  <IconZap size={14} />
                  <span>Apply</span>
                </button>
            </div>
        </div>
        <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-200 custom-scrollbar leading-relaxed">
            <code>{code}</code>
        </pre>
    </div>
  );
};

export default CodeBlock;
