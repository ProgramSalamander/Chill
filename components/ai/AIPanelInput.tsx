import React, { useState, useEffect, useRef } from 'react';
import { File } from '../../types';
import { 
  IconZap, IconPlus, IconFileCode, IconX, IconClock, 
  IconTrash, IconCheck
} from '../Icons';
import { useChatStore } from '../../stores/chatStore';
import { useFileStore } from '../../stores/fileStore';

interface AIPanelInputProps {
  mode: 'chat' | 'agent';
  isGenerating: boolean;
  isAgentRunning: boolean;
  onSend: (text: string, contextFileIds?: string[]) => void;
  activeFile: File | null;
}

const AIPanelInput: React.FC<AIPanelInputProps> = ({
  mode,
  isGenerating,
  isAgentRunning,
  onSend,
  activeFile
}) => {
  const [input, setInput] = useState('');
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([]);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [promptHistory, setPromptHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('vibe_prompt_history') || '[]');
    } catch { return []; }
  });

  const contextScope = useChatStore(state => state.contextScope);
  const setContextScope = useChatStore(state => state.setContextScope);
  const files = useFileStore(state => state.files);

  const pickerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowContextPicker(false);
      }
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!input.trim() || isGenerating || isAgentRunning) return;

    const trimmedInput = input.trim();
    setPromptHistory(prev => {
      const newHist = [trimmedInput, ...prev.filter(p => p !== trimmedInput)].slice(0, 50);
      localStorage.setItem('vibe_prompt_history', JSON.stringify(newHist));
      return newHist;
    });

    let contextIds = [...pinnedFiles];
    if (contextScope === 'file' && activeFile && !contextIds.includes(activeFile.id)) {
      contextIds.push(activeFile.id);
    }

    onSend(input, contextIds.length > 0 ? contextIds : undefined);
    setInput('');
    setPinnedFiles([]);
  };
  
  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPromptHistory([]);
    localStorage.removeItem('vibe_prompt_history');
    setShowHistory(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const togglePin = (fileId: string) => {
    setPinnedFiles(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);
  };

  return (
    <div className="p-4 bg-white/5 border-t border-white/5 backdrop-blur-md z-20">
      {pinnedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 animate-in slide-in-from-bottom-1">
          {pinnedFiles.map(fid => {
            const f = files.find(file => file.id === fid);
            if (!f) return null;
            return (
              <div key={fid} className="flex items-center gap-1 bg-vibe-accent/20 border border-vibe-accent/30 text-vibe-glow text-[10px] px-2 py-0.5 rounded-full">
                <IconFileCode size={10} />
                <span>{f.name}</span>
                <button onClick={() => togglePin(fid)} className="hover:text-white"><IconX size={10} /></button>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative group">
        <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 blur ${mode === 'agent' ? 'from-orange-500 to-red-500' : 'from-vibe-accent to-purple-600'}`}></div>
        <div className="relative flex items-end gap-2 bg-[#0a0a0f]/90 border border-white/10 rounded-xl p-2 shadow-inner">
          <div className="relative" ref={historyRef}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'text-vibe-glow bg-vibe-accent/10' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
              title="Prompt History"
            >
              <IconClock size={18} />
            </button>
            {showHistory && (
              <div className="absolute bottom-full left-0 mb-2 w-64 max-h-60 bg-[#0f0f16] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-100 z-50">
                <div className="p-2 border-b border-white/10 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                  <span>Recent Prompts</span>
                  {promptHistory.length > 0 && (
                    <button onClick={handleClearHistory} className="text-xs text-red-400 hover:text-red-300 p-1 rounded hover:bg-white/5 transition-colors" title="Clear History">
                      <IconTrash size={12} />
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto custom-scrollbar p-1">
                  {promptHistory.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setInput(prompt); setShowHistory(false); }}
                      className="w-full text-left px-2 py-2 rounded text-xs text-slate-300 hover:bg-white/5 hover:text-white truncate border-b border-white/5 last:border-0 transition-colors"
                      title={prompt}
                    >
                      {prompt}
                    </button>
                  ))}
                  {promptHistory.length === 0 && <div className="p-4 text-center text-xs text-slate-600 italic">No history yet</div>}
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowContextPicker(!showContextPicker)}
              className={`p-2 rounded-lg transition-colors ${pinnedFiles.length > 0 || showContextPicker ? 'text-vibe-glow bg-vibe-accent/10' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
              title="Pin Context Files"
            >
              <IconPlus size={18} />
            </button>
            {showContextPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-64 max-h-60 bg-[#0f0f16] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-100 z-50">
                <div className="p-2 border-b border-white/10 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Files to Pin
                </div>
                <div className="overflow-y-auto custom-scrollbar p-1">
                  {files.filter(f => f.type === 'file').map(f => (
                    <button
                      key={f.id}
                      onClick={() => togglePin(f.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left ${pinnedFiles.includes(f.id) ? 'bg-vibe-accent/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                    >
                      <span className={pinnedFiles.includes(f.id) ? 'text-vibe-glow' : 'opacity-50'}>
                        <IconFileCode size={14} />
                      </span>
                      <span className="truncate">{f.name}</span>
                      {pinnedFiles.includes(f.id) && <IconCheck size={12} className="ml-auto text-vibe-glow" />}
                    </button>
                  ))}
                  {files.length === 0 && <div className="p-2 text-center text-xs text-slate-600">No files</div>}
                </div>
              </div>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'agent' ? "Describe a task for the agent..." : "Ask Vibe AI..."}
            className="w-full bg-transparent border-none text-sm text-white focus:outline-none placeholder-slate-600 resize-none py-2 max-h-32 min-h-[40px] custom-scrollbar"
            style={{ height: Math.min(input.split('\n').length * 20 + 20, 120) + 'px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating || isAgentRunning}
            className={`p-2 rounded-lg text-white transition-all shadow-lg hover:shadow-xl disabled:bg-slate-800 disabled:text-slate-600 ${mode === 'agent' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/30' : 'bg-vibe-accent hover:bg-indigo-400 shadow-indigo-500/30'}`}
          >
            <IconZap size={18} fill={input.trim() ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      {mode === 'chat' && (
        <div className="mt-2 flex justify-between items-center px-1">
          <div className="flex gap-2 text-[9px] text-slate-500 font-mono uppercase tracking-wide">
            <button onClick={() => setContextScope('file')} className={`hover:text-white transition-colors flex items-center gap-1 ${contextScope === 'file' ? 'text-vibe-glow' : ''}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${contextScope === 'file' ? 'bg-vibe-glow' : 'bg-slate-700'}`}></div>
              Current File
            </button>
            <span className="opacity-30">|</span>
            <button onClick={() => setContextScope('project')} className={`hover:text-white transition-colors flex items-center gap-1 ${contextScope === 'project' ? 'text-vibe-glow' : ''}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${contextScope === 'project' ? 'bg-vibe-glow' : 'bg-slate-700'}`}></div>
              Full Project
            </button>
          </div>
          <span className="text-[9px] text-slate-600">Markdown Supported</span>
        </div>
      )}
    </div>
  );
};

export default AIPanelInput;