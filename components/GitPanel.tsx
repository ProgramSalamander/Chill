
import React, { useState } from 'react';
import { File, Commit } from '../types';
import { generateCommitMessage } from '../services/geminiService';
import { 
  IconGitCommit, 
  IconPlusCircle, 
  IconMinusCircle, 
  IconCheck, 
  IconClock, 
  IconGitBranch,
  IconSparkles
} from './Icons';

interface GitPanelProps {
  files: File[];
  stagedFileIds: string[];
  commits: Commit[];
  onStage: (fileId: string) => void;
  onUnstage: (fileId: string) => void;
  onCommit: (message: string) => void;
  onDiscard?: (fileId: string) => void;
}

const GitPanel: React.FC<GitPanelProps> = ({ 
  files, 
  stagedFileIds, 
  commits, 
  onStage, 
  onUnstage, 
  onCommit 
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Determine modified files (difference between content and committedContent)
  // We only care about files, not folders
  const modifiedFiles = files.filter(f => 
    f.type === 'file' && 
    (f.content !== (f.committedContent || '')) && // Content changed from HEAD
    !stagedFileIds.includes(f.id) // Not already staged
  );

  const stagedFiles = files.filter(f => stagedFileIds.includes(f.id));

  const handleCommit = () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    onCommit(commitMessage);
    setCommitMessage('');
  };

  const handleGenerateMessage = async () => {
    if (stagedFiles.length === 0) return;
    setIsGenerating(true);
    
    try {
      // Construct a simple context for the AI
      // In a real app, this would be a proper diff. Here we send the file content + info.
      const changes = stagedFiles.map(f => {
         const oldContent = f.committedContent || '';
         const newContent = f.content;
         const isNew = !f.committedContent;
         
         return `File: ${f.name} (${isNew ? 'New' : 'Modified'})\nCode:\n${newContent}\n`; 
      }).join('\n---\n');

      const msg = await generateCommitMessage(changes);
      if (msg) setCommitMessage(msg);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-vibe-800/30">
      <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center bg-black/10">
        <div className="flex items-center gap-2">
            <IconGitBranch size={14} className="text-vibe-accent" />
            <span>Source Control</span>
        </div>
        <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">main</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {/* Commit Input Area */}
        <div className="space-y-2">
            <div className="relative">
                <textarea 
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Message (Ctrl+Enter to commit)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-vibe-accent/50 min-h-[80px] resize-none placeholder-slate-600 pr-8"
                    onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            handleCommit();
                        }
                    }}
                />
                <button 
                    onClick={handleGenerateMessage}
                    disabled={isGenerating || stagedFiles.length === 0}
                    className="absolute right-2 top-2 p-1.5 rounded-md text-slate-500 hover:text-vibe-glow hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                    title="Generate AI Commit Message"
                >
                    <IconSparkles size={14} className={isGenerating ? "animate-pulse text-vibe-glow" : ""} />
                </button>
            </div>
            <button 
                onClick={handleCommit}
                disabled={stagedFiles.length === 0 || !commitMessage.trim()}
                className="w-full py-1.5 bg-vibe-accent hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-vibe-accent text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-2"
            >
                <IconCheck size={14} />
                Commit
            </button>
        </div>

        {/* Staged Changes */}
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Staged Changes ({stagedFiles.length})</span>
            </div>
            <div className="space-y-0.5">
                {stagedFiles.length === 0 && (
                    <div className="text-[10px] text-slate-600 italic px-2">No files staged</div>
                )}
                {stagedFiles.map(file => (
                    <div key={file.id} className="group flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 text-sm text-slate-300">
                        <div className="flex items-center gap-2 truncate">
                            <IconGitCommit size={14} className="text-green-400/70" />
                            <span className="truncate">{file.name}</span>
                        </div>
                        <button 
                            onClick={() => onUnstage(file.id)}
                            className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Unstage Changes"
                        >
                            <IconMinusCircle size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* Changes */}
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Changes ({modifiedFiles.length})</span>
            </div>
            <div className="space-y-0.5">
                {modifiedFiles.length === 0 && (
                    <div className="text-[10px] text-slate-600 italic px-2">Working tree clean</div>
                )}
                {modifiedFiles.map(file => (
                    <div key={file.id} className="group flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 text-sm text-slate-300">
                        <div className="flex items-center gap-2 truncate">
                            <span className="text-yellow-500/70 text-[10px] font-mono font-bold">M</span>
                            <span className="truncate">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Potential Discard button could go here */}
                            <button 
                                onClick={() => onStage(file.id)}
                                className="text-slate-500 hover:text-white"
                                title="Stage Changes"
                            >
                                <IconPlusCircle size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Commit History */}
        {commits.length > 0 && (
             <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>History</span>
                </div>
                <div className="space-y-2 relative">
                    {/* Vertical line for history timeline */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/10" />
                    
                    {commits.slice().reverse().map(commit => (
                        <div key={commit.id} className="relative pl-5 py-1">
                            <div className="absolute left-[5px] top-[9px] w-[5px] h-[5px] rounded-full bg-vibe-500 ring-2 ring-vibe-900" />
                            <div className="text-xs text-slate-300 font-medium">{commit.message}</div>
                            <div className="text-[10px] text-slate-600 flex items-center gap-2 mt-0.5">
                                <span className="flex items-center gap-1">
                                    <IconClock size={10} />
                                    {new Date(commit.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </span>
                                <span>•</span>
                                <span>{commit.author}</span>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        )}
      </div>
    </div>
  );
};

export default GitPanel;
