
import { useState, useEffect, useCallback, useRef } from 'react';
import { File } from '../types';
import { processDirectoryHandle, getLanguage, getFilePath, resolveFileByPath } from '../utils/fileUtils';
import ignore from 'ignore';

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
  const [projectHandle, setProjectHandle] = useState<any>(null);

  // --- Persistence ---
  useEffect(() => {
    // Strip non-serializable FS handles before saving to LS
    const safeFiles = files.map(({ handle, ...rest }) => ({ ...rest, handle: undefined }));
    localStorage.setItem('vibe_files_backup', JSON.stringify(safeFiles));
  }, [files]);

  // --- Actions ---

  const handleOpenFolder = useCallback(async () => {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      addTerminalLine(`Opening local directory: ${dirHandle.name}...`, 'command');
      
      const ig = ignore();
      try {
          const gitignoreHandle = await dirHandle.getFileHandle('.gitignore');
          const file = await gitignoreHandle.getFile();
          const content = await file.text();
          ig.add(content);
      } catch (e) { /* No .gitignore */ }

      const loadedFiles = await processDirectoryHandle(dirHandle, null, '', ig);
      
      setFiles(loadedFiles);
      setProjectHandle(dirHandle);
      setActiveFileId('');
      setOpenFileIds([]);
      
      addTerminalLine(`Loaded project: ${dirHandle.name} with ${loadedFiles.length} items.`, 'success');
      return loadedFiles;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         addTerminalLine(`Error opening folder: ${err.message}`, 'error');
      }
      return null;
    }
  }, [addTerminalLine]);

  const resetProject = useCallback(() => {
      setFiles([]);
      setActiveFileId('');
      setOpenFileIds([]);
      setProjectHandle(null);
  }, []);

  const createNode = useCallback(async (type: 'file' | 'folder', parentId: string | null, name: string, initialContent?: string) => {
    const existing = files.some(f => f.parentId === parentId && f.name === name);
    if (existing) {
        addTerminalLine(`Error: ${type} "${name}" already exists.`, 'error');
        return null;
    }

    let handle: any = undefined;
    if (projectHandle) {
        try {
            let parentHandle = projectHandle;
            if (parentId) {
                const parentFile = files.find(f => f.id === parentId);
                if (parentFile && parentFile.handle) parentHandle = parentFile.handle;
            }
            if (type === 'file') handle = await parentHandle.getFileHandle(name, { create: true });
            else handle = await parentHandle.getDirectoryHandle(name, { create: true });
        } catch (e) {
             addTerminalLine(`FS Create Error: ${e}`, 'error');
             return null;
        }
    }

    const newFile: File = {
      id: Math.random().toString(36).slice(2, 11),
      name,
      type,
      parentId,
      isOpen: type === 'folder' ? true : undefined,
      language: type === 'file' ? getLanguage(name) : '',
      content: initialContent || (type === 'file' ? (type === 'file' && getLanguage(name) === 'python' ? '# Python File\n' : '// Start coding...') : ''),
      isModified: type === 'file' && !initialContent ? false : true, // If created with content, assume modified until saved? Or synced.
      history: type === 'file' ? { past: [], future: [], lastSaved: 0 } : undefined,
      handle
    };
    
    setFiles(prev => [...prev, newFile]);
    
    if (type === 'file' && !initialContent) {
        setOpenFileIds(prev => [...prev, newFile.id]);
        setActiveFileId(newFile.id);
    }
    
    addTerminalLine(`Created ${type}: ${newFile.name}`, 'success');
    return newFile;
  }, [files, projectHandle, addTerminalLine]);

  const renameNode = useCallback(async (id: string, newName: string) => {
      const file = files.find(f => f.id === id);
      if (!file) return;

      if (projectHandle && file.handle && file.handle.move) {
          try { await file.handle.move(newName); } 
          catch (e) { addTerminalLine(`FS Rename Error: ${e} (Memory only)`, 'error'); }
      }
      
      setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName, language: f.type === 'file' ? getLanguage(newName) : f.language } : f));
      addTerminalLine(`Renamed to ${newName}`, 'info');
  }, [files, projectHandle, addTerminalLine]);

  const deleteNode = useCallback(async (file: File) => {
      if (projectHandle) {
         try {
             let parentHandle = projectHandle;
             if (file.parentId) {
                 const parent = files.find(f => f.id === file.parentId);
                 if (parent && parent.handle) parentHandle = parent.handle;
             }
             await parentHandle.removeEntry(file.name, { recursive: file.type === 'folder' });
         } catch (e) {
             addTerminalLine(`FS Delete Error: ${e}`, 'error');
             return;
         }
      }

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
  }, [files, projectHandle, activeFileId, addTerminalLine]);

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
    if (file.handle) {
        try {
            const writable = await file.handle.createWritable();
            await writable.write(file.content);
            await writable.close();
        } catch (err) {
            addTerminalLine(`Error saving to disk: ${err}`, 'error');
            return false;
        }
    }
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
      projectHandle,
      handleOpenFolder,
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
