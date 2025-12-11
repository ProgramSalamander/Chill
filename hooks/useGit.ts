
import { useState, useCallback } from 'react';
import { gitService, GitStatus } from '../services/gitService';
import { Commit, File } from '../types';
import { getFilePath } from '../utils/fileUtils';

export const useGit = (files: File[], addTerminalLine: (msg: string, type?: any) => void) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [status, setStatus] = useState<GitStatus[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isCloning, setIsCloning] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const refresh = useCallback(async () => {
     if (!isInitialized) return;
     try {
         const s = await gitService.status();
         setStatus(s);
         const logs = await gitService.log();
         // @ts-ignore
         setCommits(logs);
     } catch (e) {
         console.error('Git Refresh Error', e);
     }
  }, [isInitialized]);

  const init = useCallback(async (currentFiles: File[]) => {
      await gitService.init(); 
      setIsInitialized(true);
      
      // Sync all current files to git
      for (const f of currentFiles) {
          if (f.type === 'file') {
              const path = getFilePath(f, currentFiles);
              await gitService.writeFile(path, f.content);
          }
      }
      addTerminalLine('Git repository initialized.', 'success');
  }, [addTerminalLine]);

  const syncFile = useCallback(async (file: File) => {
      if (!isInitialized) return;
      const path = getFilePath(file, files);
      await gitService.writeFile(path, file.content);
      refresh();
  }, [isInitialized, files, refresh]);

  const deleteFile = useCallback(async (file: File) => {
      if (!isInitialized) return;
      const path = getFilePath(file, files);
      await gitService.deleteFile(path);
      refresh();
  }, [isInitialized, files, refresh]);

  const stage = useCallback(async (fileId: string) => {
    if (!isInitialized) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const path = getFilePath(file, files);
    await gitService.add(path);
    refresh();
  }, [isInitialized, files, refresh]);

  const unstage = useCallback(async (fileId: string) => {
    if (!isInitialized) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const path = getFilePath(file, files);
    await gitService.reset(path);
    refresh();
  }, [isInitialized, files, refresh]);

  const commit = useCallback(async (message: string) => {
    if (!isInitialized) return;
    const sha = await gitService.commit(message);
    addTerminalLine(`Commit ${sha.slice(0, 7)}: ${message}`, 'success');
    refresh();
  }, [isInitialized, addTerminalLine, refresh]);

  const clone = useCallback(async (url: string) => {
    setIsCloning(true);
    addTerminalLine(`Cloning from ${url}...`, 'command');
    try {
        await gitService.clear(); 
        await gitService.clone(url);
        
        const newFiles = await gitService.loadFilesToMemory();
        setIsInitialized(true);
        addTerminalLine('Repository cloned successfully.', 'success');
        return newFiles;
    } catch (e: any) {
        addTerminalLine(`Clone failed: ${e.message}`, 'error');
        console.error(e);
        return null;
    } finally {
        setIsCloning(false);
    }
  }, [addTerminalLine]);

  const pull = useCallback(async (): Promise<File[] | null> => {
    if (!isInitialized) return null;
    setIsPulling(true);
    addTerminalLine('Pulling from remote...', 'command');
    try {
        await gitService.pull();
        const newFiles = await gitService.loadFilesToMemory();
        addTerminalLine('Pulled successfully. Workspace updated.', 'success');
        refresh(); // To update status and commits
        return newFiles;
    } catch (e: any) {
        addTerminalLine(`Pull failed: ${e.message}`, 'error');
        console.error(e);
        return null;
    } finally {
        setIsPulling(false);
    }
  }, [isInitialized, addTerminalLine, refresh]);

  const fetch = useCallback(async () => {
    if (!isInitialized) return;
    setIsFetching(true);
    addTerminalLine('Fetching from remote...', 'command');
    try {
        await gitService.fetch();
        addTerminalLine('Fetch complete.', 'success');
        refresh();
    } catch (e: any) {
        addTerminalLine(`Fetch failed: ${e.message}`, 'error');
        console.error(e);
    } finally {
        setIsFetching(false);
    }
  }, [isInitialized, addTerminalLine, refresh]);

  const reset = useCallback(() => {
      setIsInitialized(false);
      setStatus([]);
      setCommits([]);
  }, []);

  return {
      isInitialized,
      status,
      commits,
      isCloning,
      isPulling,
      isFetching,
      init,
      refresh,
      syncFile,
      deleteFile,
      stage,
      unstage,
      commit,
      clone,
      pull,
      fetch,
      reset,
      setIsInitialized // Helper for when we detect .git in a folder open
  };
};