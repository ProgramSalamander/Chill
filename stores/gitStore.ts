
import { create } from 'zustand';
import { gitService, GitStatus } from '../services/gitService';
import { Commit, File } from '../types';
import { getFilePath } from '../utils/fileUtils';
import { useFileTreeStore } from './fileStore';
import { errorService } from '../services';
import { notify } from './notificationStore';

interface GitState {
  isInitialized: boolean;
  status: GitStatus[];
  commits: Commit[];
  isCloning: boolean;
  isPulling: boolean;
  isFetching: boolean;
  isPushing: boolean;
  cloneProgress: { phase: string; loaded: number; total: number } | null;

  // Actions
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  syncFile: (file: File) => Promise<void>;
  syncAllFilesToFs: () => Promise<void>;
  deleteFile: (file: File) => Promise<void>;
  stage: (fileId: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstage: (fileId: string) => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (message: string) => Promise<void>;
  clone: (url: string) => Promise<boolean>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  fetch: () => Promise<void>;
  revertFile: (fileId: string) => Promise<void>;
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
  isPushing: false,
  cloneProgress: null,

  checkForExistingRepo: async () => {
    try {
        const isRepo = await gitService.isRepoInitialized();
        if (isRepo) {
            set({ isInitialized: true });
            // Critical: Ensure the FS actually has the files the store says it has
            // otherwise Git status will show everything as 'deleted'
            await get().syncAllFilesToFs();
            await get().refresh();
            errorService.report('Git repository connected.', 'Git', { notifyUser: false, terminal: true, severity: 'info' });
        } else {
            set({ isInitialized: false, status: [], commits: [] });
        }
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
      console.error("Git refresh error", e);
    }
  },

  syncAllFilesToFs: async () => {
    const { files } = useFileTreeStore.getState();
    const actualFiles = files.filter(f => f.type === 'file');
    for (const f of actualFiles) {
        const path = getFilePath(f, files);
        await gitService.writeFile(path, f.content);
    }
  },

  init: async () => {
    try {
      const isAlreadyInitialized = await gitService.isRepoInitialized();
      if(isAlreadyInitialized) {
          set({ isInitialized: true });
          await get().syncAllFilesToFs();
          await get().refresh();
          return;
      }

      await gitService.init();
      set({ isInitialized: true });
      await get().syncAllFilesToFs();
      
      errorService.report('Git repository initialized.', 'Git', { notifyUser: false, terminal: true, severity: 'info' });
      get().refresh();
    } catch (e: any) {
      errorService.report(e, "Git Initialization");
    }
  },

  syncFile: async (file) => {
    if (!get().isInitialized) return;
    try {
      const path = getFilePath(file, useFileTreeStore.getState().files);
      await gitService.writeFile(path, file.content);
      get().refresh();
    } catch (e: any) {
      console.error("Git sync error", e);
    }
  },

  deleteFile: async (file) => {
    if (!get().isInitialized) return;
    try {
      const path = getFilePath(file, useFileTreeStore.getState().files);
      await gitService.deleteFile(path);
      get().refresh();
    } catch (e: any) {}
  },

  stage: async (fileId) => {
    if (!get().isInitialized) return;
    try {
      const file = useFileTreeStore.getState().files.find(f => f.id === fileId);
      if (!file) return;
      const path = getFilePath(file, useFileTreeStore.getState().files);
      await gitService.add(path);
      get().refresh();
    } catch (e: any) {
      errorService.report(e, "Git Stage");
    }
  },

  stageAll: async () => {
    if (!get().isInitialized) return;
    try {
      const unstagedFiles = get().status.filter(s => 
          s.status === 'added' || s.status === 'modified' || s.status === 'deleted'
      );
      if (unstagedFiles.length === 0) return;
      for (const fileStatus of unstagedFiles) {
          await gitService.add(fileStatus.filepath);
      }
      notify(`Staged ${unstagedFiles.length} files.`, 'info');
      get().refresh();
    } catch (e: any) {
      errorService.report(e, "Git Stage All");
    }
  },

  unstage: async (fileId) => {
    if (!get().isInitialized) return;
    try {
      const file = useFileTreeStore.getState().files.find(f => f.id === fileId);
      if (!file) return;
      const path = getFilePath(file, useFileTreeStore.getState().files);
      await gitService.reset(path);
      get().refresh();
    } catch (e: any) {
      errorService.report(e, "Git Unstage");
    }
  },

  unstageAll: async () => {
      if (!get().isInitialized) return;
      try {
        const stagedFiles = get().status.filter(s => 
            s.status === '*added' || s.status === '*modified' || s.status === '*deleted'
        );
        if (stagedFiles.length === 0) return;
        for (const fileStatus of stagedFiles) {
            await gitService.reset(fileStatus.filepath);
        }
        notify(`Unstaged ${stagedFiles.length} files.`, 'info');
        get().refresh();
      } catch (e: any) {
        errorService.report(e, "Git Unstage All");
      }
  },

  commit: async (message) => {
    if (!get().isInitialized) return;
    try {
      const sha = await gitService.commit(message);
      notify(`Committed ${sha.slice(0, 7)}`, 'success');
      get().refresh();
    } catch (e: any) {
      errorService.report(e, "Git Commit");
    }
  },

  clone: async (url) => {
    set({ isCloning: true, cloneProgress: { phase: 'Preparing...', loaded: 0, total: 1 } });
    try {
        errorService.report(`Cloning from ${url}...`, 'Git', { notifyUser: false, terminal: true, severity: 'info' });
        const onProgress = (progress: { phase: string; loaded: number; total: number }) => {
            set({ cloneProgress: progress });
        };
        await gitService.clone(url, undefined, onProgress);
        const newFiles = await gitService.loadFilesToMemory();
        useFileTreeStore.getState().setAllFiles(newFiles);
        set({ isInitialized: true, isCloning: false, cloneProgress: null });
        notify('Repository cloned successfully.', 'success');
        get().refresh();
        return true;
    } catch (e: any) {
        errorService.report(e, "Git Clone");
        set({ isCloning: false, cloneProgress: null });
        return false;
    }
  },

  pull: async () => {
    if (!get().isInitialized) return;
    set({ isPulling: true });
    errorService.report('Pulling from remote...', 'Git', { notifyUser: false, terminal: true, severity: 'info' });
    try {
      await gitService.pull();
      const newFiles = await gitService.loadFilesToMemory();
      useFileTreeStore.getState().setAllFiles(newFiles);
      notify('Pull successful. Workspace updated.', 'success');
      get().refresh();
    } catch (e: any) {
        errorService.report(e, "Git Pull");
    } finally {
      set({ isPulling: false });
    }
  },

  push: async () => {
    if (!get().isInitialized) return;
    set({ isPushing: true });
    errorService.report('Pushing to remote...', 'Git', { notifyUser: false, terminal: true, severity: 'info' });
    try {
      const result = await gitService.push();
      if (result.ok) {
        notify('Push successful.', 'success');
      } else {
        errorService.report(result.error || 'Unknown push error.', "Git Push");
      }
    } catch (e: any) {
        errorService.report(e, "Git Push");
    } finally {
      set({ isPushing: false });
      get().refresh();
    }
  },

  fetch: async () => {
    if (!get().isInitialized) return;
    set({ isFetching: true });
    errorService.report('Fetching from remote...', 'Git', { notifyUser: false, terminal: true, severity: 'info' });
    try {
      await gitService.fetch();
      notify('Fetch complete.', 'info');
    } catch (e: any) {
        errorService.report(e, "Git Fetch");
    } finally {
      set({ isFetching: false });
      get().refresh();
    }
  },

  revertFile: async (fileId) => {
    if (!get().isInitialized) return;
    const { files, updateFileContent, deleteNode, saveFile } = useFileTreeStore.getState();
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const path = getFilePath(file, files);
    try {
        const headContent = await gitService.readBlob(path).catch(() => null);
        await gitService.checkout(path);
        if (headContent !== null) {
            updateFileContent(headContent, true, file.id);
            const updatedFile = useFileTreeStore.getState().files.find(f => f.id === fileId);
            if (updatedFile) saveFile(updatedFile);
            notify(`Reverted changes in ${file.name}`, 'info');
        } else {
            await deleteNode(file);
            notify(`Discarded new file ${file.name}`, 'info');
        }
    } catch (e: any) {
        errorService.report(e, `Git Revert: ${file.name}`);
    } finally {
        get().refresh();
    }
  },

  reset: () => {
    set({ isInitialized: false, status: [], commits: [] });
  },
}));
