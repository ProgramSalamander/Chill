import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { File } from '../types';
import { getLanguage } from '../utils/fileUtils';
import { useTerminalStore } from './terminalStore';
import { useGitStore } from './gitStore';
import { useProjectStore } from './projectStore';
import { notify } from '../stores/notificationStore';
import type { RAGService } from '../services/ragService';

interface FileTreeState {
  files: File[];
  activeFileId: string;
  openFileIds: string[];
  fileToDelete: File | null;
  _ragService: RAGService | null;

  // Actions
  setDependencies: (services: { ragService: RAGService }) => void;
  setAllFiles: (newFiles: File[]) => void;
  resetFiles: () => void;
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
}

export const useFileTreeStore = create<FileTreeState>()(
  persist(
    (set, get) => ({
      files: [],
      activeFileId: '',
      openFileIds: [],
      fileToDelete: null,
      _ragService: null,

      setDependencies: (services) => set({ _ragService: services.ragService }),

      setAllFiles: (newFiles) => {
        set({ files: newFiles, openFileIds: [], activeFileId: '' });
        get()._ragService?.triggerDebouncedUpdate(newFiles);
      },

      resetFiles: () => {
        set({ files: [], activeFileId: '', openFileIds: [] });
      },

      createNode: async (type, parentId, name, initialContent) => {
        const { files } = get();
        const { addTerminalLine } = useTerminalStore.getState();
        
        let finalName = name.trim();
        if (!finalName) {
            finalName = type === 'file' ? 'untitled.ts' : 'new-folder';
        }

        let counter = 1;
        const existingNames = new Set(files.filter(f => f.parentId === parentId).map(f => f.name));

        const nameParts = finalName.match(/(.+?)(\.[^.]+)?$/);
        const baseName = nameParts ? nameParts[1] : finalName;
        const extension = nameParts ? nameParts[2] || '' : '';

        let tempName = finalName;
        while (existingNames.has(tempName)) {
            tempName = `${baseName} (${counter})${extension}`;
            counter++;
        }
        finalName = tempName;

        const newFile: File = {
          id: Math.random().toString(36).slice(2, 11),
          name: finalName, 
          type, parentId,
          isOpen: type === 'folder' ? true : undefined,
          language: type === 'file' ? getLanguage(finalName) : '',
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
        get()._ragService?.triggerDebouncedUpdate(get().files);
        return true;
      },

      saveAllFiles: async () => {
        const modified = get().files.filter(f => f.isModified);
        for (const f of modified) await get().saveFile(f);
        if (modified.length > 0) notify(`Saved ${modified.length} files.`, 'success');
        useProjectStore.getState().saveCurrentProject();
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
        await get().deleteNode(fileToDelete);
        if (fileToDelete.type === 'file') {
            await useGitStore.getState().deleteFile(fileToDelete);
        }
        set({ fileToDelete: null });
      },
    }),
    {
      name: 'vibe-file-tree-storage',
      partialize: (state) => ({ 
        files: state.files, 
        activeFileId: state.activeFileId,
        openFileIds: state.openFileIds,
      }),
    }
  )
);
