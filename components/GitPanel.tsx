
import React, { useState } from 'react';
import { File, Commit } from '../types';
import { generateCommitMessage } from '../services/geminiService';
import { GitStatus } from '../services/gitService';
import { 
  IconPlusCircle, 
  IconMinusCircle, 
  IconClock, 
  IconGitBranch,
  IconSparkles,
  IconSearch,
  IconZap,
  IconRefresh,
  IconArrowDown
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
  onClone: (url: string) => void;
  isCloning: boolean;
  onPull: () => void;
  onFetch: () => void;
  isPulling: boolean;
  isFetching: boolean;
}

const GitPanel: React.FC<GitPanelProps> = ({ 
  isInitialized,
  files, 
  gitStatus,
  commits, 
  onStage, 
  onUnstage, 
  onCommit,
  onInitialize,
  onClone,
  isCloning,
  onPull,
  onFetch,
  isPulling,
  isFetching
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
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

  const handleClone = () => {
    if (repoUrl.trim()) {
      onClone(repoUrl.trim());
    }
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
         colorClass = "text-red-200";
     }

     const fileId = getFileIdByPath(item.filepath);

     return (
         <div key={item.filepath} className="flex items-center justify-between group py-1">
             <div className="flex items-center gap-2 overflow-hidden">
                 {icon}
                 <span className={`text-xs truncate ${colorClass}`}>{item.filepath}</span>
             </div>
             <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                 {isStaged ? (
                     <button onClick={() => fileId && onUnstage(fileId)} className="p-1 hover:text-white text-slate-500" title="Unstage"><IconMinusCircle size={14} /></button>
                 ) : (
                     <button onClick={() => fileId && onStage(fileId)} className="p-1 hover:text-white text-slate-500" title="Stage"><IconPlusCircle size={14} /></button>
                 )}
             </div>
         </div>
     );
  };

  if (!isInitialized) {
      return (
          <div className="p-4 flex flex-col gap-6 text-center animate-in fade-in slide-in-from-left-4">
              <div className="mt-4 opacity-50">
                  <IconGitBranch size={48} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm text-slate-400">No source control active</p>
              </div>
              
              <div className="space-y-3">
                  <button 
                    onClick={onInitialize}
                    className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-slate-300 hover:text-white"
                  >
                      <IconSparkles size={14} />
                      Initialize Repository
                  </button>
                  
                  <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/5"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-[#0f0f16] px-2 text-slate-600">Or Clone</span>
                      </div>
                  </div>

                  <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/username/repo"
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-vibe-accent placeholder-slate-700"
                      />
                      <button 
                        onClick={handleClone}
                        disabled={isCloning || !repoUrl}
                        className="w-full py-2 bg-vibe-accent/20 border border-vibe-accent/30 text-vibe-glow rounded-lg text-sm hover:bg-vibe-accent/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                         {isCloning ? (
                             <>
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Cloning...
                             </>
                         ) : (
                             <>
                                <IconSearch size={14} />
                                Clone from URL
                             </>
                         )}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
      <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
          {/* Action Header */}
          <div className="p-2 border-b border-white/5 flex items-center gap-2 shrink-0">
            <button 
              onClick={onFetch}
              disabled={isPulling || isFetching}
              className="flex-1 py-1.5 px-2 bg-white/5 text-slate-300 rounded-md text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isFetching ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <IconRefresh size={14} />}
              <span>{isFetching ? 'Fetching...' : 'Fetch'}</span>
            </button>
            <button 
              onClick={onPull}
              disabled={isPulling || isFetching}
              className="flex-1 py-1.5 px-2 bg-white/5 text-slate-300 rounded-md text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isPulling ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <IconArrowDown size={14} />}
              <span>{isPulling ? 'Pulling...' : 'Pull'}</span>
            </button>
          </div>

          {/* Commit Input Section */}
          <div className="p-4 border-b border-white/5 space-y-3 bg-white/[0.02]">
              <textarea 
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-vibe-accent resize-none h-20 placeholder-slate-700 custom-scrollbar"
              />
              <div className="flex gap-2">
                  <button 
                    onClick={handleCommit}
                    disabled={!commitMessage || stagedFiles.length === 0}
                    className="flex-1 py-1.5 bg-vibe-accent text-white rounded-md text-xs font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                      Commit
                  </button>
                  <button 
                     onClick={handleGenerateMessage}
                     disabled={stagedFiles.length === 0 || isGenerating}
                     className="px-3 py-1.5 bg-white/5 text-slate-300 rounded-md text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30"
                     title="Generate with AI"
                  >
                      {isGenerating ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <IconZap size={14} />}
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-6">
              {/* Staged */}
              <div>
                  <div className="flex items-center justify-between px-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staged Changes</span>
                      <span className="text-[10px] bg-white/5 px-1.5 rounded-full text-slate-500">{stagedFiles.length}</span>
                  </div>
                  <div className="space-y-0.5">
                      {stagedFiles.map(f => renderFileItem(f, true))}
                      {stagedFiles.length === 0 && <div className="px-2 text-xs text-slate-600 italic">No staged changes</div>}
                  </div>
              </div>

              {/* Changes */}
              <div>
                   <div className="flex items-center justify-between px-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Changes</span>
                      <span className="text-[10px] bg-white/5 px-1.5 rounded-full text-slate-500">{unstagedFiles.length}</span>
                  </div>
                  <div className="space-y-0.5">
                      {unstagedFiles.map(f => renderFileItem(f, false))}
                      {unstagedFiles.length === 0 && <div className="px-2 text-xs text-slate-600 italic">Working tree clean</div>}
                  </div>
              </div>

               {/* History */}
               <div>
                   <div className="flex items-center justify-between px-2 mb-2 mt-4 pt-4 border-t border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">History</span>
                  </div>
                  <div className="space-y-3 px-2">
                      {commits.length === 0 && <div className="text-xs text-slate-600 italic">No commits yet</div>}
                      {commits.map(c => (
                          <div key={c.oid} className="relative pl-3 border-l border-white/10 pb-1">
                              <div className="absolute -left-[3.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-vibe-accent"></div>
                              <div className="text-xs text-slate-200 font-medium truncate">{c.commit.message}</div>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                      <IconClock size={10} />
                                      {new Date(c.commit.author.timestamp * 1000).toLocaleDateString()}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-600 bg-white/5 px-1 rounded">{c.oid.slice(0, 7)}</span>
                              </div>
                          </div>
                      ))}
                  </div>
               </div>
          </div>
      </div>
  );
};

export default GitPanel;