
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  IconTerminal, 
  IconPlay, 
  IconSave, 
  IconSparkles,
  IconClose, 
  IconCommand,
  IconFilePlus,
  IconFolderOpen,
  IconFileCode,
  IconGitBranch,
  IconSearch,
  IconSettings,
  IconEye,
  IconEyeOff
} from './components/Icons';
import CodeEditor from './components/CodeEditor';
import AIPanel from './components/AIPanel';
import Terminal from './components/Terminal';
import SettingsModal from './components/SettingsModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import CommandPalette from './components/CommandPalette';
import FileExplorer from './components/FileExplorer';
import GitPanel from './components/GitPanel';
import ContextBar from './components/ContextBar';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import EditorTabs from './components/EditorTabs';

import { createChatSession, sendMessageStream, getCodeCompletion } from './services/geminiService';
import { initRuff, runPythonLint } from './services/lintingService';
import { gitService, GitStatus } from './services/gitService';
import { File, Message, MessageRole, TerminalLine, Commit, Diagnostic, AISession } from './types';
import { getLanguage, getFilePath, processDirectoryHandle, resolveFileByPath, generateProjectContext } from './utils/fileUtils';
import { generatePreviewHtml } from './utils/previewUtils';

const INITIAL_FILES: File[] = [];

const SYSTEM_INSTRUCTION = `You are VibeCode AI, an expert coding assistant integrated into a futuristic IDE. 
Your goal is to help the user write clean, modern, and efficient code.
When providing code, wrap it in markdown code blocks with the language specified.
Be concise, helpful, and "vibey" - professional but modern and slightly enthusiastic.
If the user asks to modify the current file, provide the full updated code block so they can apply it.
You have access to the project structure and contents when the user enables full context. Use this to understand dependencies and imports.`;

function App() {
  // --- Persistence & State Init ---
  
  // Restore files from local storage if available
  const [files, setFiles] = useState<File[]>(() => {
    try {
        const saved = localStorage.getItem('vibe_files_backup');
        return saved ? JSON.parse(saved) : INITIAL_FILES;
    } catch { return INITIAL_FILES; }
  });

  const [activeFileId, setActiveFileId] = useState<string>(''); 
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  
  // Restore Layout Settings
  const [activeSidebarView, setActiveSidebarView] = useState<'explorer' | 'git' | null>(() => {
      try {
        const saved = localStorage.getItem('vibe_layout_sidebar');
        return saved ? JSON.parse(saved) : 'explorer';
      } catch { return 'explorer'; }
  });

  const [projectHandle, setProjectHandle] = useState<any>(null); // For File System Access API
  
  const [isAIOpen, setIsAIOpen] = useState(false);
  
  const [isTerminalOpen, setIsTerminalOpen] = useState(() => {
      try {
        const saved = localStorage.getItem('vibe_layout_terminal');
        return saved ? JSON.parse(saved) : true;
      } catch { return true; }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const [contextScope, setContextScope] = useState<'project' | 'file'>(() => {
       try {
        const saved = localStorage.getItem('vibe_context_scope');
        return (saved === 'project' || saved === 'file') ? saved : 'project';
       } catch { return 'project'; }
  });

  // --------------------------------

  // Git State
  const [isGitInitialized, setIsGitInitialized] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('vibe_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: Message) => ({ ...m, isStreaming: false }));
      }
    } catch (e) {
      console.error('Failed to load chat history', e);
    }
    return [];
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<File | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>('');
  
  // Linting State
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const lintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatSessionRef = useRef<AISession | null>(null);
  const messagesRef = useRef(messages);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorPosRef = useRef(0);
  const activeFileIdRef = useRef(activeFileId);
  const lastContentRef = useRef<string>('');
  const lastActiveFileIdForEffect = useRef<string | null>(null);

  // We need refs to latest files for the Agent callbacks to work without stale closures
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem('vibe_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  // --- Persistence Effects ---
  useEffect(() => {
    // Strip non-serializable FS handles before saving to LS
    const safeFiles = files.map(({ handle, ...rest }) => ({ ...rest, handle: undefined }));
    localStorage.setItem('vibe_files_backup', JSON.stringify(safeFiles));
  }, [files]);

  useEffect(() => {
      localStorage.setItem('vibe_layout_sidebar', JSON.stringify(activeSidebarView));
  }, [activeSidebarView]);

  useEffect(() => {
      localStorage.setItem('vibe_layout_terminal', JSON.stringify(isTerminalOpen));
  }, [isTerminalOpen]);

  useEffect(() => {
      localStorage.setItem('vibe_context_scope', contextScope);
  }, [contextScope]);
  // ---------------------------

  const addTerminalLine = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
    setTerminalLines(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 11),
      text,
      type,
      timestamp: Date.now()
    }]);
  }, []);

  const initChat = useCallback(() => {
    try {
      // Filter only user/model messages for history
      const history = messagesRef.current
        .filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL);

      chatSessionRef.current = createChatSession(SYSTEM_INSTRUCTION, history);
      addTerminalLine('System initialized. VibeCode AI connected.', 'info');
    } catch (e) {
      addTerminalLine('Failed to initialize AI session.', 'error');
    }
  }, [addTerminalLine]);

  // Init Service
  useEffect(() => {
    initRuff().then(() => console.log('Ruff Linter initialized'));
    initChat();
    
    // We do NOT auto-init git here anymore.
    // Standard behavior: Wait for user to open folder or create project.
    // If files loaded from LS, we could theoretically check if we want to restore git state, 
    // but without persistent FS handle to .git, we treat as fresh session uninitialized.
  }, [initChat]);

  const activeFile = files.find(f => f.id === activeFileId && f.type === 'file') || null;

  const refreshGit = useCallback(async () => {
     if (!isGitInitialized) return;
     try {
         const status = await gitService.status();
         setGitStatus(status);
         const logs = await gitService.log();
         // @ts-ignore
         setCommits(logs);
     } catch (e) {
         console.error('Git Refresh Error', e);
     }
  }, [isGitInitialized]);

  // Sync virtual files to git fs
  const syncFileToGit = async (file: File) => {
      if (!isGitInitialized) return;
      const path = getFilePath(file, filesRef.current);
      await gitService.writeFile(path, file.content);
      refreshGit();
  };

  const handleAgentAction = useCallback(async (action: string, args: any): Promise<string> => {
      const currentFiles = filesRef.current;
      
      switch (action) {
          case 'listFiles': {
             // Generate a tree string
             const filePaths = currentFiles.map(f => {
                 const type = f.type === 'folder' ? '[DIR]' : '[FILE]';
                 const path = getFilePath(f, currentFiles);
                 return `${type} ${path}`;
             });
             return filePaths.sort().join('\n');
          }
          
          case 'readFile': {
             const path = args.path;
             if (!path) return "Error: path is required";
             const file = resolveFileByPath(path, currentFiles);
             if (file) {
                 if (file.type === 'folder') return "Error: Path points to a folder, not a file.";
                 return file.content;
             }
             return `Error: File not found at path ${path}`;
          }

          case 'writeFile': {
             const { path, content } = args;
             if (!path || content === undefined) return "Error: path and content are required";
             
             // Check if exists
             const existing = resolveFileByPath(path, currentFiles);
             if (existing) {
                 // Update content
                 handleFileChange(content, true, existing.id);
                 return `Updated file: ${existing.name}`;
             } else {
                 // Create new
                 const name = path.split('/').pop() || 'untitled';
                 handleCreateNode('file', null, name, content);
                 return `Created new file: ${name}`;
             }
          }

          case 'runCommand': {
              const cmd = args.command;
              addTerminalLine(`Agent Executing: ${cmd}`, 'command');
              return `Command executed (simulation): ${cmd}\nExit Code: 0`;
          }
          
          default:
              return `Unknown tool: ${action}`;
      }
  }, [addTerminalLine]);

  // --- File System Access API ---
  const handleOpenFolder = async () => {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      
      addTerminalLine(`Opening local directory: ${dirHandle.name}...`, 'command');
      setIsGenerating(true); 

      // Reset Git State completely for new project
      setGitStatus([]);
      setCommits([]);
      setIsGitInitialized(false); // Default to not initialized until we know or user inits

      const loadedFiles = await processDirectoryHandle(dirHandle);
      
      setFiles(loadedFiles);
      setProjectHandle(dirHandle);
      setActiveFileId('');
      setOpenFileIds([]);

      // Note: We cannot easily detect valid .git repos via File System Access API 
      // because browser restrictions often hide .git folders or block access.
      // We assume "No Git" by default. User must Initialize if they want tracking in this IDE.
      
      addTerminalLine(`Loaded project: ${dirHandle.name} with ${loadedFiles.length} items.`, 'success');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         addTerminalLine(`Error opening folder: ${err.message}`, 'error');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNewProject = async () => {
      if (files.length > 0) {
          const confirmed = window.confirm("Start a new project? Any unsaved changes in memory will be lost.");
          if (!confirmed) return;
      }
      
      setFiles([]);
      setActiveFileId('');
      setOpenFileIds([]);
      setProjectHandle(null);
      setGitStatus([]);
      setCommits([]);
      setMessages([]);
      setTerminalLines([]);
      setIsGitInitialized(false);

      addTerminalLine('New project created. Git not initialized.', 'info');
  };

  const handleInitializeGit = async () => {
      await gitService.init(); 
      setIsGitInitialized(true);
      
      // Sync all current files to git
      for (const f of files) {
          if (f.type === 'file') {
              const path = getFilePath(f, files);
              await gitService.writeFile(path, f.content);
          }
      }
      refreshGit();
      addTerminalLine('Git repository initialized.', 'success');
  };
  // -----------------------------

  const getPreviewContent = useMemo(() => {
    if (!isPreviewOpen) return '';
    return generatePreviewHtml(files, activeFile);
  }, [files, activeFile, isPreviewOpen]);


  const handleKeyUpdate = () => {
    initChat();
    addTerminalLine('API Key configuration updated. Session refreshed.', 'success');
  };

  const handleFileClick = (file: File) => {
    if (file.type === 'folder') {
        handleToggleFolder(file.id);
    } else {
        if (!openFileIds.includes(file.id)) {
            setOpenFileIds(prev => [...prev, file.id]);
        }
        setActiveFileId(file.id);
        setSelectedCode('');
        
        // Immediate linting on file switch
        if (file.language === 'python') {
            const diags = runPythonLint(file.content);
            setDiagnostics(diags);
        } else {
            setDiagnostics([]);
        }
    }
  };

  const handleToggleFolder = (fileId: string) => {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, isOpen: !f.isOpen } : f));
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newOpenIds = openFileIds.filter(fid => fid !== id);
    setOpenFileIds(newOpenIds);
    
    if (activeFileId === id) {
        if (newOpenIds.length > 0) {
            const index = openFileIds.indexOf(id);
            const newIndex = Math.min(index, newOpenIds.length - 1);
            setActiveFileId(newOpenIds[newIndex]);
        } else {
            setActiveFileId('');
        }
    }
    setSelectedCode('');
    setDiagnostics([]);
  };

  const handleFileChange = (newContent: string, forceHistory: boolean = false, targetId?: string) => {
    const idToUpdate = targetId || activeFileId;
    if (!idToUpdate) return;

    if (idToUpdate === activeFileId && selectedCode) setSelectedCode('');

    setFiles(prev => prev.map(f => {
        if (f.id !== idToUpdate) return f;
        
        const now = Date.now();
        const history = f.history || { past: [], future: [], lastSaved: 0 };
        const timeDiff = now - history.lastSaved;
        const isSignificant = Math.abs(newContent.length - f.content.length) > 2;

        if (forceHistory || timeDiff > 1000 || isSignificant) {
            return {
                ...f,
                content: newContent,
                isModified: true,
                history: {
                    past: [...history.past, f.content],
                    future: [], 
                    lastSaved: now
                }
            };
        }

        return {
            ...f,
            content: newContent,
            isModified: true
        };
    }));
    
    if (idToUpdate === activeFileId) {
        setSuggestion(null);

        const updatedFile = files.find(f => f.id === idToUpdate);
        if (updatedFile?.language === 'python' || (updatedFile === undefined && activeFile?.language === 'python')) {
            if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
            lintTimerRef.current = setTimeout(() => {
                const diags = runPythonLint(newContent);
                setDiagnostics(diags);
            }, 500);
        }
    }
  };

  const handleUndo = () => {
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
  };

  const handleRedo = () => {
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
  };

  const handleCursorChange = (newPos: number) => {
    if (!newPos || newPos == lastCursorPosRef.current) {
      return;
    }
    setCursorPosition(newPos);
    lastCursorPosRef.current = newPos;
    if (suggestion) {
       setSuggestion(null); 
    }
  };
  
  const handleSelectionChange = useCallback((selection: string) => {
    setSelectedCode(selection);
  }, []);

  const handleContextAction = (action: string) => {
    if (!selectedCode || !activeFile) return;
    
    setIsAIOpen(true);
    let prompt = '';
    const lang = activeFile.language;
    const codeWrapper = `\`\`\`${lang}\n${selectedCode}\n\`\`\``;

    switch (action) {
        case 'explain':
            prompt = `Explain the following code snippet:\n\n${codeWrapper}`;
            break;
        case 'refactor':
            prompt = `Refactor the following code to be cleaner, more efficient, and modern. Explain your changes briefly:\n\n${codeWrapper}`;
            break;
        case 'docs':
            prompt = `Add comprehensive documentation (JSDoc/Docstrings) and comments to the following code:\n\n${codeWrapper}`;
            break;
        case 'debug':
            prompt = `Analyze the following code for potential bugs, logical errors, or edge cases. Fix them and explain why:\n\n${codeWrapper}`;
            break;
        case 'types':
             prompt = `Add strict type definitions to the following code:\n\n${codeWrapper}`;
             break;
    }
    
    if (prompt) handleSendMessage(prompt);
  };

  const handleGitStage = async (fileId: string) => {
    if (!isGitInitialized) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const path = getFilePath(file, files);
    await gitService.add(path);
    refreshGit();
  };

  const handleGitUnstage = async (fileId: string) => {
    if (!isGitInitialized) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const path = getFilePath(file, files);
    await gitService.reset(path);
    refreshGit();
  };

  const handleGitCommit = async (message: string) => {
    if (!isGitInitialized) return;
    const sha = await gitService.commit(message);
    addTerminalLine(`Commit ${sha.slice(0, 7)}: ${message}`, 'success');
    refreshGit();
  };

  const fetchCodeSuggestion = useCallback(async (isAuto: boolean = false) => {
    if (!activeFile || isGenerating || isFetchingSuggestion) return;
    if (activeFile.id !== activeFileIdRef.current) return;

    setIsFetchingSuggestion(true);
    if (!isAuto) addTerminalLine('Fetching suggestion...', 'info');
    
    try {
        const context = generateProjectContext(files);
        const cursor = lastCursorPosRef.current; 
        
        const suggestionText = await getCodeCompletion(
            activeFile.content, 
            cursor, 
            activeFile.language, 
            context
        );
        
        if (activeFileIdRef.current !== activeFile.id) return;

        if (suggestionText) {
            setSuggestion(suggestionText);
            if (!isAuto) addTerminalLine('Suggestion received.', 'success');
        } else {
            if (!isAuto) addTerminalLine('No suggestion available.', 'info');
        }
    } catch (e) {
        console.error(e);
        if (!isAuto) addTerminalLine('Failed to fetch suggestion.', 'error');
    } finally {
        setIsFetchingSuggestion(false);
    }
  }, [activeFile, isGenerating, isFetchingSuggestion, files, addTerminalLine]);

  useEffect(() => {
    if (!activeFile) return;

    const fileChanged = activeFile.id !== lastActiveFileIdForEffect.current;
    lastActiveFileIdForEffect.current = activeFile.id;

    if (fileChanged) {
        lastContentRef.current = activeFile.content;
        return; 
    }

    const contentChanged = activeFile.content !== lastContentRef.current;
    lastContentRef.current = activeFile.content;

    if (contentChanged) {
        setSuggestion(null);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            fetchCodeSuggestion(true);
        }, 1200); 
    }

    return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeFile?.content, activeFile?.id, fetchCodeSuggestion]);

  const handleManualTriggerSuggestion = () => {
      fetchCodeSuggestion(false);
  };

  const handleCreateNode = async (type: 'file' | 'folder', parentId: string | null = null, name: string, initialContent?: string) => {
    if (filesRef.current.some(f => f.parentId === parentId && f.name === name)) {
        addTerminalLine(`Error: ${type} "${name}" already exists in this location.`, 'error');
        return;
    }

    let handle: any = undefined;
    
    // File System Access API Create
    if (projectHandle) {
        try {
            let parentHandle = projectHandle;
            if (parentId) {
                const parentFile = filesRef.current.find(f => f.id === parentId);
                if (parentFile && parentFile.handle) {
                    parentHandle = parentFile.handle;
                }
            }
            
            if (type === 'file') {
                handle = await parentHandle.getFileHandle(name, { create: true });
            } else {
                handle = await parentHandle.getDirectoryHandle(name, { create: true });
            }
        } catch (e) {
             addTerminalLine(`FS Create Error: ${e}`, 'error');
             return;
        }
    }

    const newFile: File = {
      id: Math.random().toString(36).slice(2, 11),
      name: name,
      type: type,
      parentId: parentId,
      isOpen: type === 'folder' ? true : undefined,
      language: type === 'file' ? getLanguage(name) : '',
      content: initialContent || (type === 'file' ? (type === 'file' && getLanguage(name) === 'python' ? '# Python File\n' : '// Start coding...') : ''),
      isModified: type === 'file',
      history: type === 'file' ? { past: [], future: [], lastSaved: 0 } : undefined,
      handle: handle
    };
    
    setFiles(prev => [...prev, newFile]);
    
    if (type === 'file') {
        if (isGitInitialized) {
            const path = getFilePath(newFile, [...filesRef.current, newFile]);
            await gitService.writeFile(path, newFile.content);
            refreshGit();
        }

        if (!initialContent) {
            setOpenFileIds(prev => [...prev, newFile.id]);
            setActiveFileId(newFile.id);
            setSelectedCode('');
        }
    }
    
    addTerminalLine(`Created ${type}: ${newFile.name}`, 'success');
  };

  const handleCreateRootFile = () => {
      handleCreateNode('file', null, `untitled_${files.length}.ts`);
  };

  const handleRenameNode = async (id: string, newName: string) => {
      const file = files.find(f => f.id === id);
      if (!file) return;

      // File System Access API Rename (Move)
      if (projectHandle && file.handle && file.handle.move) {
          try {
              await file.handle.move(newName);
          } catch (e) {
              addTerminalLine(`FS Rename Error: ${e} (Renaming only in memory)`, 'error');
          }
      }
      
      const oldPath = getFilePath(file, files);
      if (isGitInitialized) {
          await gitService.deleteFile(oldPath);
      }

      setFiles(prev => prev.map(f => {
          if (f.id === id) {
              return { ...f, name: newName, language: f.type === 'file' ? getLanguage(newName) : f.language };
          }
          return f;
      }));
      
      // We need to re-find the file to get new path
      const updatedFiles = files.map(f => f.id === id ? { ...f, name: newName } : f);
      const updatedFile = updatedFiles.find(f => f.id === id)!;
      
      if (isGitInitialized) {
          const newPath = getFilePath(updatedFile, updatedFiles);
          await gitService.writeFile(newPath, updatedFile.content);
          refreshGit();
      }

      addTerminalLine(`Renamed to ${newName}`, 'info');
  };

  const handleSave = async () => {
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;

    // File System Access API Save
    if (file.handle) {
        try {
            const writable = await file.handle.createWritable();
            await writable.write(file.content);
            await writable.close();
        } catch (err) {
            addTerminalLine(`Error saving to disk: ${err}`, 'error');
            return;
        }
    }

    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, isModified: false } : f
    ));

    await syncFileToGit(file);
    addTerminalLine(`Saved file: ${file.name}`, 'success');
  };

  const handleSaveAll = async () => {
      const modified = files.filter(f => f.isModified);
      let count = 0;
      for (const f of modified) {
          // FS API Write
          if (f.handle) {
             try {
                const writable = await f.handle.createWritable();
                await writable.write(f.content);
                await writable.close();
             } catch(e) { console.error(e); }
          }
          // Git sync
          await syncFileToGit(f);
          count++;
      }
      // Update state
      setFiles(prev => prev.map(f => f.isModified ? { ...f, isModified: false } : f));
      if (count > 0) addTerminalLine(`Saved ${count} files.`, 'success');
  };

  const getDescendantIds = (fileId: string, allFiles: File[]): string[] => {
      const children = allFiles.filter(f => f.parentId === fileId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
          ids = [...ids, ...getDescendantIds(c.id, allFiles)];
      });
      return ids;
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;

    // File System Access API Delete
    if (projectHandle) {
         try {
             let parentHandle = projectHandle;
             if (fileToDelete.parentId) {
                 const parent = files.find(f => f.id === fileToDelete.parentId);
                 if (parent && parent.handle) parentHandle = parent.handle;
             }
             await parentHandle.removeEntry(fileToDelete.name, { recursive: fileToDelete.type === 'folder' });
         } catch (e) {
             addTerminalLine(`FS Delete Error: ${e}`, 'error');
             return;
         }
    }

    const idsToDelete = [fileToDelete.id, ...getDescendantIds(fileToDelete.id, files)];
    
    // Remove from Git
    if (fileToDelete.type === 'file' && isGitInitialized) {
        const path = getFilePath(fileToDelete, files);
        await gitService.deleteFile(path);
        // Note: deleting in FS shows as 'deleted' in git status.
    }
    
    const newFiles = files.filter(f => !idsToDelete.includes(f.id));
    setFiles(newFiles);

    const newOpenIds = openFileIds.filter(id => !idsToDelete.includes(id));
    setOpenFileIds(newOpenIds);
    
    if (activeFileId && idsToDelete.includes(activeFileId)) {
        if (newOpenIds.length > 0) {
            setActiveFileId(newOpenIds[newOpenIds.length - 1]);
        } else {
            setActiveFileId('');
        }
    }
    
    refreshGit();
    addTerminalLine(`Deleted ${fileToDelete.type}: ${fileToDelete.name}`, 'info');
    setFileToDelete(null);
  };

  const handleSendMessage = async (text: string) => {
    if (!chatSessionRef.current) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      let prompt = text;
      
      if (contextScope === 'project') {
          const context = generateProjectContext(files);
          prompt = `
[PROJECT CONTEXT START]
${context}
[PROJECT CONTEXT END]

[USER QUERY]
${text}
`;
      } else if (activeFile && !text.includes('Explain the following code snippet')) {
        prompt = `[Current Context: File "${activeFile.name}" (${activeFile.language})]\n\n${activeFile.content}\n\nUser Query: ${text}`;
      }

      // Updated to use the unified method
      const stream = await sendMessageStream(chatSessionRef.current, prompt);
      
      const responseId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: responseId,
        role: MessageRole.MODEL,
        text: '',
        timestamp: Date.now(),
        isStreaming: true
      }]);

      let fullText = '';
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => prev.map(msg => 
            msg.id === responseId ? { ...msg, text: fullText } : msg
          ));
        }
      }

      setMessages(prev => prev.map(msg => 
        msg.id === responseId ? { ...msg, isStreaming: false } : msg
      ));

    } catch (error: any) {
      console.error(error);
      addTerminalLine('Error communicating with AI service.', 'error');
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.SYSTEM,
        text: `Error: ${error.message || 'Could not connect to AI'}. Check Settings.`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyCode = (code: string) => {
    if (!activeFile) return;
    handleFileChange(code, true);
    addTerminalLine(`Applied (Replaced) AI generated code to ${activeFile.name}`, 'command');
  };

  const handleInsertCode = (code: string) => {
    if (!activeFile) return;
    const currentContent = activeFile.content;
    const insertPos = Math.min(Math.max(0, cursorPosition), currentContent.length);
    const newContent = currentContent.slice(0, insertPos) + code + currentContent.slice(insertPos);
    handleFileChange(newContent, true);
    addTerminalLine(`Inserted code at line ${activeFile.content.slice(0, insertPos).split('\n').length}`, 'success');
  };

  const handleAcceptSuggestion = () => {
    if (!activeFile || !suggestion) return;
    const currentContent = activeFile.content;
    const prefix = currentContent.slice(0, cursorPosition);
    const suffix = currentContent.slice(cursorPosition);
    
    const newContent = prefix + suggestion + suffix;
    const newCursorPos = cursorPosition + suggestion.length;

    handleFileChange(newContent, true);
    setCursorPosition(newCursorPos);
    lastCursorPosRef.current = newCursorPos;
    
    setSuggestion(null);
    addTerminalLine('Autocomplete applied.', 'success');
  };

  const runCode = () => {
    addTerminalLine(`Running ${activeFile?.name}...`, 'command');
    if (activeFile?.language === 'typescript' || activeFile?.language === 'javascript') {
        try {
            const log = console.log;
            const logs: string[] = [];
            console.log = (...args) => logs.push(args.join(' '));
            
            let jsCode = activeFile.content
              .replace(/:\s*[a-zA-Z0-9_<>\[\]]+/g, '') 
              .replace(/<[^>]+>/g, ''); 

            // eslint-disable-next-line no-new-func
            new Function(jsCode)();
            
            console.log = log;
            
            if (logs.length > 0) {
                logs.forEach(l => addTerminalLine(l, 'info'));
            }
            addTerminalLine('Execution finished successfully.', 'success');
        } catch (e: any) {
            addTerminalLine(`Runtime Error: ${e.message}`, 'error');
        }
    } else {
        addTerminalLine(`Execution for ${activeFile?.language} not supported in browser yet.`, 'error');
    }
  };

  const commandActions = [
      { id: 'save', label: 'Save File', icon: <IconSave size={16}/>, shortcut: 'Cmd+S', run: handleSave },
      { id: 'format', label: 'Format Document', icon: <IconSparkles size={16}/>, run: () => addTerminalLine('Formatting not implemented', 'info') },
      { id: 'run', label: 'Run Code', icon: <IconPlay size={16}/>, shortcut: 'Cmd+Enter', run: runCode },
      { id: 'toggle-terminal', label: 'Toggle Terminal', icon: <IconTerminal size={16}/>, shortcut: 'Cmd+J', run: () => setIsTerminalOpen(v => !v) },
      { id: 'toggle-ai', label: 'Toggle AI Assistant', icon: <IconSparkles size={16}/>, run: () => setIsAIOpen(v => !v) },
      { id: 'new-file', label: 'New File', icon: <IconFilePlus size={16}/>, run: handleCreateRootFile },
      { id: 'open-folder', label: 'Open Folder', icon: <IconFolderOpen size={16}/>, run: handleOpenFolder },
  ];

  // Global Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setActiveSidebarView(v => v ? null : 'explorer');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsTerminalOpen(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
         e.preventDefault();
         runCode();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeFile]);

  return (
    <div className="flex flex-col h-screen w-screen text-slate-300 font-sans overflow-hidden bg-[#050508] relative">
      <MenuBar 
          onNewProject={handleNewProject}
          onOpenProject={handleOpenFolder}
          onSaveAll={handleSaveAll}
          projectName={projectHandle?.name || (files.length > 0 ? 'Untitled Project' : undefined)}
          onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-1 flex min-h-0 min-w-0 w-full relative">
        <Sidebar 
          activeView={activeSidebarView}
          setActiveView={setActiveSidebarView}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          gitStatus={gitStatus}
        />

        {/* Sidebar Panel (Floating Glass) */}
        {activeSidebarView && (
            <div className="w-72 glass-panel flex flex-col animate-in slide-in-from-left-5 duration-300 ml-2 my-2 rounded-2xl z-30">
            {activeSidebarView === 'explorer' && (
                <>
                <div className="p-5 flex items-center justify-between border-b border-vibe-border h-16">
                    <span className="text-xs font-bold text-vibe-glow uppercase tracking-widest drop-shadow-sm">Explorer</span>
                    <div className="flex items-center gap-1">
                        <button onClick={handleCreateRootFile} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"><IconFilePlus size={16} /></button>
                        <button onClick={handleOpenFolder} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"><IconFolderOpen size={16} /></button>
                    </div>
                </div>
                <FileExplorer 
                    files={files} 
                    activeFileId={activeFileId} 
                    onFileClick={handleFileClick}
                    onDelete={(f) => setFileToDelete(f)}
                    onRename={handleRenameNode}
                    onCreate={(type, parentId, name) => handleCreateNode(type, parentId, name)}
                    onToggleFolder={handleToggleFolder}
                />
                </>
            )}
            {activeSidebarView === 'git' && (
                <GitPanel 
                    isInitialized={isGitInitialized}
                    files={files}
                    gitStatus={gitStatus}
                    commits={commits}
                    onStage={handleGitStage}
                    onUnstage={handleGitUnstage}
                    onCommit={handleGitCommit}
                    onInitialize={handleInitializeGit}
                />
            )}
            </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative m-2 gap-2">
            
            <EditorTabs 
               openFileIds={openFileIds}
               activeFileId={activeFileId}
               files={files}
               setActiveFileId={setActiveFileId}
               onCloseTab={handleCloseTab}
               onClearSelection={() => setSelectedCode('')}
               isPreviewOpen={isPreviewOpen}
               setIsPreviewOpen={setIsPreviewOpen}
               isAIOpen={isAIOpen}
               setIsAIOpen={setIsAIOpen}
               onRunCode={runCode}
            />

            {/* Editor & Content */}
            <div className="flex-1 relative overflow-hidden flex flex-col glass-panel rounded-2xl min-h-0">
                {activeFile ? (
                <div className="flex-1 relative min-h-0">
                    <CodeEditor 
                        code={activeFile.content}
                        language={activeFile.language}
                        onChange={(code) => handleFileChange(code, false)}
                        cursorOffset={cursorPosition}
                        onCursorChange={handleCursorChange}
                        onSelectionChange={handleSelectionChange}
                        suggestion={suggestion}
                        onAcceptSuggestion={handleAcceptSuggestion}
                        onTriggerSuggestion={handleManualTriggerSuggestion}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        showPreview={isPreviewOpen}
                        previewContent={getPreviewContent}
                        diagnostics={diagnostics}
                    />
                    
                    {/* Floating Action Bar for Selection - UPDATED to ContextBar */}
                    {selectedCode && (
                        <div className="absolute top-4 right-8 z-40 animate-in fade-in slide-in-from-top-2">
                            <ContextBar 
                                language={activeFile.language}
                                onAction={handleContextAction}
                            />
                        </div>
                    )}
                </div>
                ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                        <IconCommand size={40} className="text-vibe-accent opacity-50" />
                    </div>
                    <p className="text-sm font-medium text-slate-400 tracking-wide">Select a file to start your vibe coding session</p>
                    <div className="mt-4 flex gap-2">
                        <span className="text-xs bg-white/5 px-2 py-1 rounded text-slate-500">Cmd+P to search</span>
                        <span className="text-xs bg-white/5 px-2 py-1 rounded text-slate-500">Cmd+B to explorer</span>
                    </div>
                </div>
                )}

                {/* Terminal Panel */}
                <div className={`transition-all duration-300 border-t border-vibe-border ${isTerminalOpen ? 'h-56' : 'h-0 overflow-hidden'}`}>
                    <Terminal 
                    lines={terminalLines} 
                    isOpen={isTerminalOpen} 
                    diagnostics={diagnostics}
                    onSelectDiagnostic={(line, col) => {
                        if (activeFile) {
                            console.log(`Jump to ${line}:${col}`);
                        }
                    }}
                    />
                </div>
            </div>

        </div>

        {/* Overlays */}
        <div className="absolute top-0 right-0 h-full pointer-events-none">
            {/* Inner container to ensure relative positioning correct for absolute children if needed */}
            <div className="relative w-full h-full pointer-events-auto">
                 <AIPanel 
                    isOpen={isAIOpen} 
                    onClose={() => setIsAIOpen(false)}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isGenerating={isGenerating}
                    activeFile={activeFile}
                    onApplyCode={handleApplyCode}
                    onInsertCode={handleInsertCode}
                    contextScope={contextScope}
                    setContextScope={setContextScope}
                    files={files}
                    onAgentAction={handleAgentAction}
                />
            </div>
        </div>

      </div>

      <SettingsModal 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)}
         onKeyUpdate={handleKeyUpdate}
      />

      <CommandPalette 
         isOpen={isCommandPaletteOpen}
         onClose={() => setIsCommandPaletteOpen(false)}
         actions={commandActions}
         files={files}
         onSelectFile={(id) => {
             if (!openFileIds.includes(id)) {
                 setOpenFileIds(prev => [...prev, id]);
             }
             setActiveFileId(id);
             setSelectedCode('');
         }}
      />
      
      {fileToDelete && (
        <DeleteConfirmModal 
           isOpen={!!fileToDelete}
           fileName={fileToDelete.name}
           onClose={() => setFileToDelete(null)}
           onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

export default App;
