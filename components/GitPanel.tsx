

import React, { useState, useEffect } from 'react';
import { aiService } from '../services/aiService';
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
import { useGitStore } from '../stores/gitStore';
import { useFileTreeStore } from '../stores/fileStore';

const GitPanel: React.FC = () => {
  const [commitMessage, setCommitMessage] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAllStaged, setShowAllStaged] = useState(false);
  const [showAllUnstaged, setShowAllUnstaged] = useState(false);
  const INITIAL_FILES_TO_SHOW = 50;

  const isInitialized = useGitStore(state => state.isInitialized);
  const gitStatus = useGitStore(state => state.status);
  const commits = useGitStore(state => state.commits);
  const isCloning = useGitStore(state => state.isCloning);
  const isPulling = useGitStore(state => state.isPulling);
  const isFetching = useGitStore(state => state.isFetching);
  const stage = useGitStore(state => state.stage);
  const unstage = useGitStore(state => state.unstage);
  const stageAll = useGitStore(state => state.stageAll);
  const unstageAll = useGitStore(state => state.unstageAll);
  const commit = useGitStore(state => state.commit);
  const init = useGitStore(state => state.init);
  const clone = useGitStore(state => state.clone);
  const pull = useGitStore(state => state.pull);
  const fetchGit = useGitStore(state => state.fetch);
  const revertFile = useGitStore(state => state.revertFile);

  const files = useFileTreeStore(state => state.files);
  
  useEffect(() => {
    setShowAllStaged(false);
    setShowAllUnstaged(false);
  }, [gitStatus]);

  const getFileIdByPath = (path: string) => {
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
    commit(commitMessage);
    setCommitMessage('');
  };

  const handleClone = () => {
    if (repoUrl.trim()) {
      clone(repoUrl.trim());
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

      const msg = await aiService.generateCommitMessage(changes);
      if (msg) setCommitMessage(msg);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderFileItem = (item: GitStatus, isStaged: boolean) => {
     let icon = <span className="w-4 h-4 flex items-center justify-center text-yellow-500/70 text-[10px] font-mono font-bold bg-yellow-500/10 rounded-sm">M</span>;
     let colorClass = "text-amber-200";

     if (item.status.includes('added')) {
         icon = <span className="w-4 h-4 flex items-center justify-center text-green-500/70 text-[10px] font-mono font-bold bg-green-500/10 rounded-sm">A</span>;
         colorClass = "text-green-200";
     } else if (item.status.includes('deleted')) {
         icon = <span className="w-4 h-4 flex items-center justify-center text-red-500/70 text-[10px] font-mono font-bold bg-red-500/10 rounded-sm">D</span>;
         colorClass = "text-red-200";
     }

     const fileId = getFileIdByPath(item.filepath);

     return (
         <div key={item.filepath} className="flex items-center justify-between group py-1 px-2 rounded-md hover:bg-white/5 transition-colors">
             <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                 {icon}
                 <span className={`text-xs truncate ${colorClass}`}>{item.filepath}</span>
             </div>
             <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                 {isStaged ? (
                     <button onClick={() => fileId && unstage(fileId)} className="p-1.5 hover:text-white text-slate-500" title="Unstage"><IconMinusCircle size={14} /></button>
                 ) : (
                    <>
                        <button onClick={() => fileId && revertFile(fileId)} className="p-1.5 hover:text-white text-slate-500" title="Discard Changes"><IconRefresh size={14} /></button>
                        <button onClick={() => fileId && stage(fileId)} className="p-1.5 hover:text-white text-slate-500" title="Stage"><IconPlusCircle size={14} /></button>
                    </>
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
                    onClick={init}
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
              onClick={fetchGit}
              disabled={isPulling || isFetching}
              className="flex-1 py-1.5 px-2 bg-white/5 text-slate-300 rounded-md text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isFetching ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <IconRefresh size={14} />}
              <span>{isFetching ? 'Fetching...' : 'Fetch'}</span>
            </button>
            <button 
              onClick={pull}
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
                      <div className="flex items-center gap-2">
                          <button onClick={unstageAll} disabled={stagedFiles.length === 0} className="p-1 hover:text-white text-slate-500 disabled:opacity-30" title="Unstage All Changes">
                              <IconMinusCircle size={14} />
                          </button>
                          <span className="text-[10px] bg-white/5 px-1.5 rounded-full text-slate-500">{stagedFiles.length}</span>
                      </div>
                  </div>
                  <div className="space-y-0.5">
                      {(showAllStaged ? stagedFiles : stagedFiles.slice(0, INITIAL_FILES_TO_SHOW)).map(f => renderFileItem(f, true))}
                      {stagedFiles.length > INITIAL_FILES_TO_SHOW && !showAllStaged && (
                          <div className="px-2 pt-2">
                              <button 
                                  onClick={() => setShowAllStaged(true)} 
                                  className="w-full text-center text-xs text-slate-400 hover:text-white bg-white/5 py-1.5 rounded-md transition-colors"
                              >
                                  Show all {stagedFiles.length} staged files...
                              </button>
                          </div>
                      )}
                      {stagedFiles.length === 0 && <div className="px-2 text-xs text-slate-600 italic">No staged changes</div>}
                  </div>
              </div>

              {/* Changes */}
              <div>
                   <div className="flex items-center justify-between px-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Changes</span>
                      <div className="flex items-center gap-2">
                          <button onClick={stageAll} disabled={unstagedFiles.length === 0} className="p-1 hover:text-white text-slate-500 disabled:opacity-30" title="Stage All Changes">
                              <IconPlusCircle size={14} />
                          </button>
                          <span className="text-[10px] bg-white/5 px-1.5 rounded-full text-slate-500">{unstagedFiles.length}</span>
                      </div>
                  </div>
                  <div className="space-y-0.5">
                      {(showAllUnstaged ? unstagedFiles : unstagedFiles.slice(0, INITIAL_FILES_TO_SHOW)).map(f => renderFileItem(f, false))}
                      {unstagedFiles.length > INITIAL_FILES_TO_SHOW && !showAllUnstaged && (
                          <div className="px-2 pt-2">
                              <button 
                                  onClick={() => setShowAllUnstaged(true)} 
                                  className="w-full text-center text-xs text-slate-400 hover:text-white bg-white/5 py-1.5 rounded-md transition-colors"
                              >
                                  Show all {unstagedFiles.length} changes...
                              </button>
                          </div>
                      )}
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