
import { create } from 'zustand';
import { gitService, GitStatus } from '../services/gitService';
import { Commit, File } from '../types';
import { getFilePath } from '../utils/fileUtils';
import { useFileTreeStore } from './fileStore';
import { useTerminalStore } from './terminalStore';
import { notify } from './notificationStore';

interface GitState {
  isInitialized: boolean;
  status: GitStatus[];
  commits: Commit[];
  isCloning: boolean;
  isPulling: boolean;
  isFetching: boolean;
  cloneProgress: { phase: string; loaded: number; total: number } | null;

  // Actions
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  syncFile: (file: File) => Promise<void>;
  deleteFile: (file: File) => Promise<void>;
  stage: (fileId: string) => Promise<void>;
  unstage: (fileId: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  clone: (url: string) => Promise<boolean>;
  pull: () => Promise<void>;
  fetch: () => Promise<void>;
  reset: () => void;
  checkForExistingRepo: () => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  isInitialized: false,
  status: [],
  commits: [],
  isCloning: false,
  isPulling: false,
  isFetching: false,
  cloneProgress: null,

  checkForExistingRepo: async () => {
    try {
        await gitService.readConfig();
        set({ isInitialized: true });
        get().refresh();
        useTerminalStore.getState().addTerminalLine('Existing Git repository detected.', 'success');
    } catch (e) {
        set({ isInitialized: false });
    }
  },

  refresh: async () => {
    if (!get().isInitialized) return;
    try {
      const s = await gitService.status();
      const logs = await gitService.log();
      set({ status: s, commits: logs as any });
    } catch (e) {
      console.error('Git Refresh Error', e);
    }
  },

  init: async () => {
    const { addTerminalLine } = useTerminalStore.getState();
    const { files } = useFileTreeStore.getState();
    await gitService.init();
    set({ isInitialized: true });

    for (const f of files) {
      if (f.type === 'file') {
        const path = getFilePath(f, files);
        await gitService.writeFile(path, f.content);
      }
    }
    addTerminalLine('Git repository initialized.', 'success');
    get().refresh();
  },

  syncFile: async (file) => {
    if (!get().isInitialized) return;
    const path = getFilePath(file, useFileTreeStore.getState().files);
    await gitService.writeFile(path, file.content);
    get().refresh();
  },

  deleteFile: async (file) => {
    if (!get().isInitialized) return;
    const path = getFilePath(file, useFileTreeStore.getState().files);
    await gitService.deleteFile(path);
    get().refresh();
  },

  stage: async (fileId) => {
    if (!get().isInitialized) return;
    const file = useFileTreeStore.getState().files.find(f => f.id === fileId);
    if (!file) return;
    const path = getFilePath(file, useFileTreeStore.getState().files);
    await gitService.add(path);
    get().refresh();
  },

  unstage: async (fileId) => {
    if (!get().isInitialized) return;
    const file = useFileTreeStore.getState().files.find(f => f.id === fileId);
    if (!file) return;
    const path = getFilePath(file, useFileTreeStore.getState().files);
    await gitService.reset(path);
    get().refresh();
  },

  commit: async (message) => {
    if (!get().isInitialized) return;
    const sha = await gitService.commit(message);
    notify(`Committed ${sha.slice(0, 7)}`, 'success');
    get().refresh();
  },

  clone: async (url) => {
    const { addTerminalLine } = useTerminalStore.getState();
    set({ isCloning: true, cloneProgress: { phase: 'Connecting...', loaded: 0, total: 1 } });
    addTerminalLine(`Cloning from ${url}...`, 'command');
    try {
      const onProgress = (progress: { phase: string; loaded: number; total: number }) => {
         set({ cloneProgress: progress });
         if(progress.total) {
             addTerminalLine(`git (${progress.phase}): ${Math.round((progress.loaded / progress.total) * 100)}%`, 'info');
         } else {
             addTerminalLine(`git: ${progress.phase}...`, 'info');
         }
      };

      await gitService.clear();
      await gitService.clone(url, undefined, onProgress);
      const newFiles = await gitService.loadFilesToMemory();
      useFileTreeStore.getState().setAllFiles(newFiles);
      set({ isInitialized: true, isCloning: false, cloneProgress: null });
      notify('Repository cloned successfully.', 'success');
      get().refresh();
      return true;
    } catch (e: any) {
      addTerminalLine(`Clone failed: ${e.message}`, 'error');
      console.error(e);
      set({ isCloning: false, cloneProgress: null });
      return false;
    }
  },

  pull: async () => {
    if (!get().isInitialized) return;
    set({ isPulling: true });
    const { addTerminalLine } = useTerminalStore.getState();
    addTerminalLine('Pulling from remote...', 'command');
    try {
      await gitService.pull();
      const newFiles = await gitService.loadFilesToMemory();
      useFileTreeStore.getState().setAllFiles(newFiles);
      notify('Pull successful. Workspace updated.', 'success');
      set({ isPulling: false });
      get().refresh();
    } catch (e: any) {
      addTerminalLine(`Pull failed: ${e.message}`, 'error');
      console.error(e);
      set({ isPulling: false });
    }
  },

  fetch: async () => {
    if (!get().isInitialized) return;
    set({ isFetching: true });
    const { addTerminalLine } = useTerminalStore.getState();
    addTerminalLine('Fetching from remote...', 'command');
    try {
      await gitService.fetch();
      notify('Fetch complete.', 'info');
      set({ isFetching: false });
      get().refresh();
    } catch (e: any) {
      addTerminalLine(`Fetch failed: ${e.message}`, 'error');
      console.error(e);
      set({ isFetching: false });
    }
  },

  reset: () => {
    set({ isInitialized: false, status: [], commits: [] });
  },
}));
