

import { create } from 'zustand';
import { gitService, GitStatus } from '../services/gitService';
import { Commit, File } from '../types';
import { getFilePath } from '../utils/fileUtils';
import { useFileTreeStore } from './fileStore';
import { useTerminalStore } from './terminalStore';
import { notify } from './notificationStore';
import { useProjectStore } from './projectStore';

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
  stageAll: () => Promise<void>;
  unstage: (fileId: string) => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (message: string) => Promise<void>;
  clone: (url: string) => Promise<boolean>;
  pull: () => Promise<void>;
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
  cloneProgress: null,

  checkForExistingRepo: async () => {
    try {
        const isRepo = await gitService.isRepoInitialized();
        if (isRepo) {
            set({ isInitialized: true });
            get().refresh();
            useTerminalStore.getState().addTerminalLine('Existing Git repository detected.', 'success');
        } else {
            set({ isInitialized: false });
        }
    } catch (e) {
        console.error("Error checking for git repo:", e);
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
    // Check for active project.
    let activeProject = useProjectStore.getState().activeProject;
    if (!activeProject) {
        // If no active project, create one automatically.
        const newProject = await useProjectStore.getState().handleNewProject("Untitled Project");
        if (!newProject) {
            // This should not happen if we provide a name, but as a safeguard.
            notify("Project creation failed.", "error");
            return;
        }
        // `handleNewProject` has already set up the new project context.
    }
    
    const { addTerminalLine } = useTerminalStore.getState();
    const { files } = useFileTreeStore.getState();

    // Check if repo is already initialized in the current project FS.
    const isAlreadyInitialized = await gitService.isRepoInitialized();
    if(isAlreadyInitialized) {
        set({ isInitialized: true });
        get().refresh();
        return;
    }

    await gitService.init();
    set({ isInitialized: true });

    // If an existing project was not a git repo, write its files to the git FS.
    for (const f of files) {
      if (f.type === 'file') {
        const path = getFilePath(f, files);
        await gitService.writeFile(path, f.content);
      }
    }

    addTerminalLine('Git repository initialized.', 'success');
    
    // Refresh status, which will now show untracked files if any existed.
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

  stageAll: async () => {
    if (!get().isInitialized) return;
    const unstagedFiles = get().status.filter(s => 
        s.status === 'added' || s.status === 'modified' || s.status === 'deleted'
    );
    if (unstagedFiles.length === 0) return;

    for (const fileStatus of unstagedFiles) {
        await gitService.add(fileStatus.filepath);
    }
    
    notify(`Staged ${unstagedFiles.length} files.`, 'info');
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

  unstageAll: async () => {
      if (!get().isInitialized) return;
      const stagedFiles = get().status.filter(s => 
          s.status === '*added' || s.status === '*modified' || s.status === '*deleted'
      );
      if (stagedFiles.length === 0) return;

      for (const fileStatus of stagedFiles) {
          await gitService.reset(fileStatus.filepath);
      }
      
      notify(`Unstaged ${stagedFiles.length} files.`, 'info');
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
    set({ isCloning: true, cloneProgress: { phase: 'Preparing...', loaded: 0, total: 1 } });

    try {
        const repoName = url.split('/').pop()?.replace('.git', '') || 'cloned-project';
        const newProject = await useProjectStore.getState().handleNewProject(repoName);
        if (!newProject) {
            throw new Error("Project creation was cancelled or failed.");
        }

        addTerminalLine(`Cloning into project '${repoName}'...`, 'command');

        const onProgress = (progress: { phase: string; loaded: number; total: number }) => {
            set({ cloneProgress: progress });
            if (progress.total) {
                addTerminalLine(`git (${progress.phase}): ${Math.round((progress.loaded / progress.total) * 100)}%`, 'info');
            } else {
                addTerminalLine(`git: ${progress.phase}...`, 'info');
            }
        };

        // No need to clear, handleNewProject switched to a new FS context
        await gitService.clone(url, undefined, onProgress);

        const newFiles = await gitService.loadFilesToMemory();
        useFileTreeStore.getState().setAllFiles(newFiles);

        set({ isInitialized: true, isCloning: false, cloneProgress: null });
        notify('Repository cloned successfully.', 'success');
        get().refresh();

        // Save the newly cloned files into the project's local storage
        useProjectStore.getState().saveCurrentProject();

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

  revertFile: async (fileId) => {
    if (!get().isInitialized) return;
    
    const { files, updateFileContent, deleteNode, saveFile } = useFileTreeStore.getState();
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    const path = getFilePath(file, files);

    try {
        // First, determine if the file is untracked by checking if it exists in HEAD
        const headContent = await gitService.readBlob(path).catch(() => null);

        // Now, perform the checkout to revert/delete the file in the virtual FS
        await gitService.checkout(path);

        if (headContent !== null) {
            // File existed in HEAD, so it was modified or deleted. We're reverting to HEAD state.
            updateFileContent(headContent, true, file.id);
            const updatedFile = useFileTreeStore.getState().files.find(f => f.id === fileId);
            if (updatedFile) {
                saveFile(updatedFile); // This also marks isModified as false
            }
            notify(`Reverted changes in ${file.name}`, 'info');
        } else {
            // File did not exist in HEAD, so it was an untracked file. Checkout deleted it.
            await deleteNode(file);
            notify(`Discarded new file ${file.name}`, 'info');
        }
    } catch (e: any) {
        notify(`Failed to revert ${file.name}: ${e.message}`, 'error');
        console.error(e);
    } finally {
        get().refresh();
    }
  },

  reset: () => {
    set({ isInitialized: false, status: [], commits: [] });
  },
}));
