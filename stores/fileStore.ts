import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { File, ProjectMeta } from '../types';
import { getLanguage } from '../utils/fileUtils';
import { useTerminalStore } from './terminalStore';
import { useGitStore } from './gitStore';
import { projectService } from '../services/projectService';
import { useChatStore } from './chatStore';
import { notify } from '../stores/notificationStore';

interface FileState {
  files: File[];
  activeFileId: string;
  openFileIds: string[];
  activeFile: File | null;
  fileToDelete: File | null;
  projectToDelete: ProjectMeta | null;
  activeProject: ProjectMeta | null;
  recentProjects: ProjectMeta[];

  // Actions
  setAllFiles: (newFiles: File[]) => void;
  resetProject: () => void;
  createNode: (type: 'file' | 'folder', parentId: string | null, name: string, initialContent?: string) => Promise<File | null>;
  renameNode: (id: string, newName: string) => Promise<void>;
  deleteNode: (file: File) => Promise<string[]>;
  updateFileContent: (content: string, forceHistory?: boolean, targetId?: string) => void;
  saveFile: (file: File) => Promise<boolean>;
  saveAllFiles: () => Promise<void>;
  closeFile: (id: string) => void;
  toggleFolder: (id: string) => void;
  selectFile: (file: File) => void;
  undo: () => void;
  redo: () => void;
  setActiveFileId: (id: string) => void;
  setFileToDelete: (file: File | null) => void;
  confirmDelete: () => Promise<void>;
  setProjectToDelete: (project: ProjectMeta | null) => void;
  confirmDeleteProject: () => Promise<void>;
  loadInitialProject: () => void;
  handleNewProject: () => Promise<void>;
  handleLoadProject: (project: ProjectMeta) => Promise<void>;
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      files: [],
      activeFileId: '',
      openFileIds: [],
      activeFile: null,
      fileToDelete: null,
      projectToDelete: null,
      activeProject: null,
      recentProjects: [],

      setAllFiles: (newFiles) => {
        set({ files: newFiles, openFileIds: [], activeFileId: '', activeFile: null });
      },

      resetProject: () => {
        set({ files: [], activeFileId: '', openFileIds: [], activeFile: null, activeProject: null });
      },

      createNode: async (type, parentId, name, initialContent) => {
        const { files } = get();
        const { addTerminalLine } = useTerminalStore.getState();
        const existing = files.some(f => f.parentId === parentId && f.name === name);
        if (existing) {
          addTerminalLine(`Error: ${type} "${name}" already exists.`, 'error');
          return null;
        }

        const newFile: File = {
          id: Math.random().toString(36).slice(2, 11),
          name, type, parentId,
          isOpen: type === 'folder' ? true : undefined,
          language: type === 'file' ? getLanguage(name) : '',
          content: initialContent || (type === 'file' ? '' : ''),
          isModified: !!initialContent,
          history: type === 'file' ? { past: [], future: [], lastSaved: 0 } : undefined,
        };

        set(state => ({ files: [...state.files, newFile] }));

        if (type === 'file') {
          get().selectFile(newFile);
          useGitStore.getState().syncFile(newFile);
        }

        addTerminalLine(`Created ${type}: ${newFile.name}`, 'success');
        return newFile;
      },

      renameNode: async (id, newName) => {
        const file = get().files.find(f => f.id === id);
        if (!file) return;

        set(state => ({
          files: state.files.map(f => f.id === id ? { ...f, name: newName, language: f.type === 'file' ? getLanguage(newName) : f.language } : f)
        }));
        useTerminalStore.getState().addTerminalLine(`Renamed to ${newName}`, 'info');
      },

      deleteNode: async (file) => {
        const { files, activeFileId, openFileIds } = get();
        const getDescendants = (id: string, list: File[]): string[] => {
            const children = list.filter(f => f.parentId === id);
            return [...children.map(c => c.id), ...children.flatMap(c => getDescendants(c.id, list))];
        };
        const idsToDelete = [file.id, ...getDescendants(file.id, files)];
        
        set(state => ({
            files: state.files.filter(f => !idsToDelete.includes(f.id)),
            openFileIds: state.openFileIds.filter(id => !idsToDelete.includes(id)),
            activeFileId: (activeFileId && idsToDelete.includes(activeFileId)) ? '' : state.activeFileId,
        }));
        
        useTerminalStore.getState().addTerminalLine(`Deleted ${file.type}: ${file.name}`, 'info');
        return idsToDelete;
      },

      updateFileContent: (content, forceHistory = false, targetId) => {
        const idToUpdate = targetId || get().activeFileId;
        if (!idToUpdate) return;

        set(state => ({
          files: state.files.map(f => {
            if (f.id !== idToUpdate) return f;
            const now = Date.now();
            const history = f.history || { past: [], future: [], lastSaved: 0 };
            const timeDiff = now - history.lastSaved;
            const isSignificant = Math.abs(content.length - f.content.length) > 2;
            if (forceHistory || timeDiff > 1000 || isSignificant) {
              return { ...f, content, isModified: true, history: { past: [...history.past, f.content], future: [], lastSaved: now } };
            }
            return { ...f, content, isModified: true };
          })
        }));
      },

      saveFile: async (file) => {
        set(state => ({ files: state.files.map(f => f.id === file.id ? { ...f, isModified: false } : f) }));
        notify(`Saved ${file.name}`, 'success');
        useGitStore.getState().syncFile(file);
        return true;
      },

      saveAllFiles: async () => {
        const modified = get().files.filter(f => f.isModified);
        for (const f of modified) await get().saveFile(f);
        if (modified.length > 0) notify(`Saved ${modified.length} files.`, 'success');
      },

      closeFile: (id) => {
        const newOpenIds = get().openFileIds.filter(fid => fid !== id);
        let newActiveId = get().activeFileId;
        if (newActiveId === id) {
            newActiveId = newOpenIds.length > 0 ? newOpenIds[newOpenIds.length - 1] : '';
        }
        set({ openFileIds: newOpenIds, activeFileId: newActiveId });
      },

      toggleFolder: (id) => {
        set(state => ({ files: state.files.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f) }));
      },

      selectFile: (file) => {
        if (file.type === 'folder') {
          get().toggleFolder(file.id);
        } else {
          if (!get().openFileIds.includes(file.id)) {
            set(state => ({ openFileIds: [...state.openFileIds, file.id] }));
          }
          set({ activeFileId: file.id });
        }
      },

      undo: () => { /* ... implementation ... */ },
      redo: () => { /* ... implementation ... */ },

      setActiveFileId: (id) => set({ activeFileId: id }),
      setFileToDelete: (file) => set({ fileToDelete: file }),

      confirmDelete: async () => {
        const fileToDelete = get().fileToDelete;
        if (!fileToDelete) return;
        const ids = await get().deleteNode(fileToDelete);
        if (fileToDelete.type === 'file') {
            await useGitStore.getState().deleteFile(fileToDelete);
        }
        set({ fileToDelete: null });
      },

      // Project Deletion
      setProjectToDelete: (project) => set({ projectToDelete: project }),
      
      confirmDeleteProject: async () => {
        const { projectToDelete, activeProject, resetProject } = get();
        if (!projectToDelete) return;
        
        const wasActive = activeProject?.id === projectToDelete.id;

        projectService.deleteProject(projectToDelete.id);

        if (wasActive) {
          resetProject();
          useGitStore.getState().reset();
          useChatStore.getState().clearChat();
          useTerminalStore.getState().clearTerminal();
          useTerminalStore.getState().addTerminalLine(`Deleted active project: ${projectToDelete.name}`, 'info');
        }

        set({ 
          recentProjects: projectService.getRecents(),
          projectToDelete: null,
        });
        
        // If the active project was deleted and there are others, load the most recent one.
        if (wasActive && get().recentProjects.length > 0) {
          get().handleLoadProject(get().recentProjects[0]);
        }
      },

      // Project Management
      loadInitialProject: () => {
        const recents = projectService.getRecents();
        set({ recentProjects: recents });
        const lastProjectId = projectService.getActiveProjectId();
        if (lastProjectId) {
            const meta = recents.find(p => p.id === lastProjectId);
            if (meta) {
                const savedFiles = projectService.loadProject(lastProjectId);
                if (savedFiles) {
                    set({ files: savedFiles, activeProject: meta });
                    useTerminalStore.getState().addTerminalLine(`Loaded project: ${meta.name}`, 'info');
                }
            }
        }
      },
      handleNewProject: async () => {
        const name = window.prompt("Enter project name:", "Untitled Project");
        if (!name) return;
        const { activeProject, files } = get();
        if (activeProject) projectService.saveProject(files, activeProject);
        
        const newMeta = projectService.createProject(name);
        set({ activeProject: newMeta, files: [], activeFileId: '', openFileIds: [], recentProjects: projectService.getRecents() });
        
        useGitStore.getState().reset();
        useChatStore.getState().clearChat();
        useTerminalStore.getState().clearTerminal();
        useTerminalStore.getState().addTerminalLine(`New project created: ${name}`, 'success');
      },
      handleLoadProject: async (project) => {
        const { activeProject, files } = get();
        if (activeProject?.id === project.id) return;
        if (activeProject) projectService.saveProject(files, activeProject);

        const loadedFiles = projectService.loadProject(project.id);
        if (loadedFiles) {
            set({ files: loadedFiles, activeProject: project, activeFileId: '', openFileIds: [], recentProjects: projectService.getRecents() });
            projectService.saveProject(loadedFiles, project);
            useGitStore.getState().reset();
            useTerminalStore.getState().addTerminalLine(`Switched to project: ${project.name}`, 'info');
        } else {
            useTerminalStore.getState().addTerminalLine(`Failed to load project: ${project.name}`, 'error');
        }
      },
    }),
    {
      name: 'vibe-file-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Update activeFile derived state after rehydration
          const activeFile = state.files.find(f => f.id === state.activeFileId) || null;
          state.activeFile = activeFile;
          // Trigger project save on next tick
          setTimeout(() => {
            if (state.activeProject) {
              projectService.saveProject(state.files, state.activeProject);
            }
          }, 1);
        }
      },
    }
  )
);

// Subscribe to self to update derived state `activeFile`
useFileStore.subscribe(
  (state, prevState) => {
    if (state.activeFileId !== prevState.activeFileId || state.files !== prevState.files) {
      const activeFile = state.files.find(f => f.id === state.activeFileId) || null;
      useFileStore.setState({ activeFile });
    }
    if (state.files !== prevState.files && state.activeProject) {
       projectService.saveProject(state.files, state.activeProject);
       useFileStore.setState({ recentProjects: projectService.getRecents() });
    }
  }
);