
import React, { useState } from 'react';
import { File, Commit } from '../types';
import { generateCommitMessage } from '../services/geminiService';
import { GitStatus } from '../services/gitService';
import { 
  IconGitCommit, 
  IconPlusCircle, 
  IconMinusCircle, 
  IconCheck, 
  IconClock, 
  IconGitBranch,
  IconSparkles,
  IconTrash,
  IconFilePlus
} from './Icons';

interface GitPanelProps {
  isInitialized: boolean;
  files: File[];
  gitStatus: GitStatus[];
  commits: Commit[];
  onStage: (fileId: string) => void;
  onUnstage: (fileId: string) => void;
  onCommit: (message: string) => void;
  onInitialize: () => void;
}

const GitPanel: React.FC<GitPanelProps> = ({ 
  isInitialized,
  files, 
  gitStatus,
  commits, 
  onStage, 
  onUnstage, 
  onCommit,
  onInitialize
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper to map file path back to File object for the app
  const getFileIdByPath = (path: string) => {
      // Simple exact match name logic used in app
      const file = files.find(f => f.name === path || path.endsWith(f.name));
      return file ? file.id : null;
  };

  const stagedFiles = gitStatus.filter(s => 
      s.status === '*added' || s.status === '*modified' || s.status === '*deleted'
  );

  const unstagedFiles = gitStatus.filter(s => 
      s.status === 'added' || s.status === 'modified' || s.status === 'deleted'
  );

  const handleCommit = () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    onCommit(commitMessage);
    setCommitMessage('');
  };

  const handleGenerateMessage = async () => {
    if (stagedFiles.length === 0) return;
    setIsGenerating(true);
    
    try {
      const changes = stagedFiles.map(f => {
         let prefix = '';
         if (f.status === '*added') prefix = 'New File';
         else if (f.status === '*modified') prefix = 'Modified';
         else if (f.status === '*deleted') prefix = 'Deleted';

         return `File: ${f.filepath} (${prefix})\n`; 
      }).join('\n');

      const msg = await generateCommitMessage(changes);
      if (msg) setCommitMessage(msg);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderFileItem = (item: GitStatus, isStaged: boolean) => {
     let icon = <span className="text-yellow-500/70 text-[10px] font-mono font-bold">M</span>;
     let colorClass = "text-amber-200";

     if (item.status.includes('added')) {
         icon = <span className="text-green-500/70 text-[10px] font-mono font-bold">A</span>;
         colorClass = "text-green-200";
     } else if (item.status.includes('deleted')) {
         icon = <span className="text-red-500/70 text-[10px] font-mono font-bold">D</span>;
         colorClass = "text-red-300 decoration-line-through decoration-red-500/30";
     }

     const fileId = getFileIdByPath(item.filepath);

     return (
        <div key={item.filepath} className="group flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 text-sm text-slate-300">
            <div className="flex items-center gap-2 truncate">
                {icon}
                <span className={`truncate ${colorClass}`}>{item.filepath}</span>
            </div>
            {fileId && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => isStaged ? onUnstage(fileId) : onStage(fileId)}
                        className="text-slate-500 hover:text-white"
                        title={isStaged ? "Unstage Changes" : "Stage Changes"}
                    >
                        {isStaged ? <IconMinusCircle size={14} /> : <IconPlusCircle size={14} />}
                    </button>
                </div>
            )}
            {!fileId && <span className="text-[10px] text-slate-600 italic">Synced</span>}
        </div>
     );
  };

  if (!isInitialized) {
      return (
          <div className="flex flex-col h-full bg-vibe-800/30">
              <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center bg-black/10">
                <div className="flex items-center gap-2">
                    <IconGitBranch size={14} className="text-vibe-accent" />
                    <span>Source Control</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <IconGitBranch size={24} className="text-slate-500 opacity-50" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">No Repository</h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                      The current workspace is not a git repository. Initialize one to start tracking changes.
                  </p>
                  <button 
                      onClick={onInitialize}
                      className="px-4 py-2 bg-vibe-accent hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
                  >
                      Initialize Repository
                  </button>
              </div>
          </div>
      );
  }

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
                {stagedFiles.map(f => renderFileItem(f, true))}
            </div>
        </div>

        {/* Changes */}
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Changes ({unstagedFiles.length})</span>
            </div>
            <div className="space-y-0.5">
                {unstagedFiles.length === 0 && (
                    <div className="text-[10px] text-slate-600 italic px-2">Working tree clean</div>
                )}
                {unstagedFiles.map(f => renderFileItem(f, false))}
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
                    
                    {commits.map((commitObj) => {
                        // Access nested commit object structure from isomorphic-git
                        const { commit, oid } = commitObj;
                        return (
                            <div key={oid} className="relative pl-5 py-1">
                                <div className="absolute left-[5px] top-[9px] w-[5px] h-[5px] rounded-full bg-vibe-500 ring-2 ring-vibe-900" />
                                <div className="text-xs text-slate-300 font-medium">{commit.message}</div>
                                <div className="text-[10px] text-slate-600 flex items-center gap-2 mt-0.5">
                                    <span className="flex items-center gap-1">
                                        <IconClock size={10} />
                                        {/* Timestamp is in seconds in git */}
                                        {new Date(commit.committer.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                    <span>•</span>
                                    <span>{commit.committer.name}</span>
                                    <span className="font-mono opacity-50 ml-1">{oid.slice(0, 6)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
             </div>
        )}
      </div>
    </div>
  );
};

export default GitPanel;
