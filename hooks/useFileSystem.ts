

import { useState, useEffect, useCallback } from 'react';
import { File } from '../types';
import { getLanguage } from '../utils/fileUtils';

const INITIAL_FILES: File[] = [];

export const useFileSystem = (addTerminalLine: (msg: string, type?: any) => void) => {
  // --- State ---
  const [files, setFiles] = useState<File[]>(() => {
    try {
        const saved = localStorage.getItem('vibe_files_backup');
        return saved ? JSON.parse(saved) : INITIAL_FILES;
    } catch { return INITIAL_FILES; }
  });

  const [activeFileId, setActiveFileId] = useState<string>(''); 
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);

  // --- Persistence ---
  useEffect(() => {
    // Save to LS (handled purely in-memory/browser now)
    localStorage.setItem('vibe_files_backup', JSON.stringify(files));
  }, [files]);

  // --- Actions ---

  const resetProject = useCallback(() => {
      setFiles([]);
      setActiveFileId('');
      setOpenFileIds([]);
  }, []);

  const createNode = useCallback(async (type: 'file' | 'folder', parentId: string | null, name: string, initialContent?: string) => {
    const existing = files.some(f => f.parentId === parentId && f.name === name);
    if (existing) {
        addTerminalLine(`Error: ${type} "${name}" already exists.`, 'error');
        return null;
    }

    const newFile: File = {
      id: Math.random().toString(36).slice(2, 11),
      name,
      type,
      parentId,
      isOpen: type === 'folder' ? true : undefined,
      language: type === 'file' ? getLanguage(name) : '',
      content: initialContent || (type === 'file' ? (type === 'file' && getLanguage(name) === 'python' ? '# Python File\n' : '// Start coding...') : ''),
      isModified: type === 'file' && !initialContent ? false : true, // If created with content, assume modified until saved
      history: type === 'file' ? { past: [], future: [], lastSaved: 0 } : undefined
    };
    
    setFiles(prev => [...prev, newFile]);
    
    if (type === 'file' && !initialContent) {
        setOpenFileIds(prev => [...prev, newFile.id]);
        setActiveFileId(newFile.id);
    }
    
    addTerminalLine(`Created ${type}: ${newFile.name}`, 'success');
    return newFile;
  }, [files, addTerminalLine]);

  const renameNode = useCallback(async (id: string, newName: string) => {
      const file = files.find(f => f.id === id);
      if (!file) return;
      
      setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName, language: f.type === 'file' ? getLanguage(newName) : f.language } : f));
      addTerminalLine(`Renamed to ${newName}`, 'info');
  }, [files, addTerminalLine]);

  const deleteNode = useCallback(async (file: File) => {
      const getDescendants = (id: string, list: File[]): string[] => {
          const children = list.filter(f => f.parentId === id);
          return [...children.map(c => c.id), ...children.flatMap(c => getDescendants(c.id, list))];
      };

      const idsToDelete = [file.id, ...getDescendants(file.id, files)];
      setFiles(prev => prev.filter(f => !idsToDelete.includes(f.id)));
      setOpenFileIds(prev => prev.filter(id => !idsToDelete.includes(id)));
      
      if (activeFileId && idsToDelete.includes(activeFileId)) {
          setActiveFileId('');
      }
      addTerminalLine(`Deleted ${file.type}: ${file.name}`, 'info');
      return idsToDelete;
  }, [files, activeFileId, addTerminalLine]);

  const updateFileContent = useCallback((content: string, forceHistory: boolean = false, targetId?: string) => {
    const idToUpdate = targetId || activeFileId;
    if (!idToUpdate) return;

    setFiles(prev => prev.map(f => {
        if (f.id !== idToUpdate) return f;
        
        const now = Date.now();
        const history = f.history || { past: [], future: [], lastSaved: 0 };
        const timeDiff = now - history.lastSaved;
        const isSignificant = Math.abs(content.length - f.content.length) > 2;

        if (forceHistory || timeDiff > 1000 || isSignificant) {
            return {
                ...f,
                content,
                isModified: true,
                history: {
                    past: [...history.past, f.content],
                    future: [], 
                    lastSaved: now
                }
            };
        }
        return { ...f, content, isModified: true };
    }));
  }, [activeFileId]);

  const saveFile = useCallback(async (file: File) => {
    // Purely state update for cloud/browser native environment
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, isModified: false } : f));
    addTerminalLine(`Saved file: ${file.name}`, 'success');
    return true;
  }, [addTerminalLine]);

  const closeFile = useCallback((id: string) => {
    const newOpenIds = openFileIds.filter(fid => fid !== id);
    setOpenFileIds(newOpenIds);
    if (activeFileId === id) {
        if (newOpenIds.length > 0) {
            setActiveFileId(newOpenIds[newOpenIds.length - 1]);
        } else {
            setActiveFileId('');
        }
    }
  }, [openFileIds, activeFileId]);

  const toggleFolder = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f));
  }, []);

  const selectFile = useCallback((file: File) => {
     if (file.type === 'folder') {
         toggleFolder(file.id);
     } else {
         if (!openFileIds.includes(file.id)) setOpenFileIds(prev => [...prev, file.id]);
         setActiveFileId(file.id);
     }
  }, [openFileIds, toggleFolder]);

  const undo = useCallback(() => {
    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile || !activeFile.history || activeFile.history.past.length === 0) return;
    
    setFiles(prev => prev.map(f => {
      if (f.id !== activeFileId) return f;
      const history = f.history!;
      const previous = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, -1);
      
      return {
        ...f,
        content: previous,
        history: {
          past: newPast,
          future: [f.content, ...history.future],
          lastSaved: Date.now()
        }
      };
    }));
    addTerminalLine('Undo', 'info');
  }, [files, activeFileId, addTerminalLine]);

  const redo = useCallback(() => {
    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile || !activeFile.history || activeFile.history.future.length === 0) return;

    setFiles(prev => prev.map(f => {
      if (f.id !== activeFileId) return f;
      const history = f.history!;
      const next = history.future[0];
      const newFuture = history.future.slice(1);

      return {
        ...f,
        content: next,
        history: {
          past: [...history.past, f.content],
          future: newFuture,
          lastSaved: Date.now()
        }
      };
    }));
    addTerminalLine('Redo', 'info');
  }, [files, activeFileId, addTerminalLine]);

  const activeFile = files.find(f => f.id === activeFileId) || null;

  // Direct injection for cloning where we replace everything
  const setAllFiles = useCallback((newFiles: File[]) => {
      setFiles(newFiles);
      setOpenFileIds([]);
      setActiveFileId('');
  }, []);

  return {
      files,
      activeFile,
      activeFileId,
      openFileIds,
      resetProject,
      createNode,
      renameNode,
      deleteNode,
      updateFileContent,
      saveFile,
      closeFile,
      selectFile,
      toggleFolder,
      undo,
      redo,
      setActiveFileId,
      setAllFiles
  };
};
