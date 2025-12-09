
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  IconMenu, 
  IconTerminal, 
  IconSettings, 
  IconPlay, 
  IconMessage, 
  IconPlus, 
  IconSave, 
  IconSearch, 
  IconSparkles,
  IconUndo, 
  IconRedo, 
  IconClose,
  IconCommand,
  IconFolderPlus,
  IconFilePlus,
  IconTrash,
  IconFileCode,
  IconGitBranch,
  IconFolder,
  IconEye,
  IconEyeOff,
  IconFolderOpen,
  IconMore
} from './components/Icons';
import CodeEditor from './components/CodeEditor';
import AIPanel from './components/AIPanel';
import Terminal from './components/Terminal';
import SettingsModal from './components/SettingsModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import CommandPalette from './components/CommandPalette';
import FileExplorer from './components/FileExplorer';
import GitPanel from './components/GitPanel';
import { createChatSession, sendMessageStream, getCodeCompletion } from './services/geminiService';
import { initRuff, runPythonLint } from './services/lintingService';
import { File, Message, MessageRole, TerminalLine, Commit, Diagnostic } from './types';
import { Chat, Content } from '@google/genai';

// Helper to infer language from extension
const getLanguage = (filename: string) => {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.md')) return 'markdown';
  return 'typescript'; // Default
};

// Recursively read directory handle
const processDirectoryHandle = async (dirHandle: any, parentId: string | null = null): Promise<File[]> => {
  let entries: File[] = [];
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
      const id = Math.random().toString(36).slice(2, 11);
      
      if (entry.kind === 'file') {
          // Filter out annoying system files
          if (['.DS_Store', 'thumbs.db'].includes(entry.name)) continue;
          
          try {
            const fileHandle = await dirHandle.getFileHandle(entry.name);
            const fileData = await fileHandle.getFile();
            
            let content = '';
            // Only read text for reasonably sized files to avoid freezing
            if (fileData.size < 5000000) { // < 5MB
                 try {
                     content = await fileData.text();
                 } catch (e) {
                     content = '[Binary or Non-Text Content]';
                 }
            } else {
                content = '[File too large to display]';
            }

            entries.push({
                id,
                name: entry.name,
                type: 'file',
                parentId,
                language: getLanguage(entry.name),
                content,
                committedContent: content,
                handle: fileHandle, 
                history: { past: [], future: [], lastSaved: Date.now() }
            });
          } catch (e) {
             console.error(`Failed to read file ${entry.name}`, e);
          }

      } else if (entry.kind === 'directory') {
           // Skip heavy folders for this demo
           if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv'].includes(entry.name)) {
               entries.push({
                  id,
                  name: entry.name,
                  type: 'folder',
                  parentId,
                  isOpen: false,
                  language: '',
                  content: '',
                  handle: entry
               });
               continue;
           }
           
           const folderHandle = await dirHandle.getDirectoryHandle(entry.name);
           entries.push({
              id,
              name: entry.name,
              type: 'folder',
              parentId,
              isOpen: false,
              language: '',
              content: '',
              handle: folderHandle
           });
           
           // Recursion
           const children = await processDirectoryHandle(folderHandle, id);
           entries = [...entries, ...children];
      }
  }
  return entries;
};

const INITIAL_FILES: File[] = [];

const SYSTEM_INSTRUCTION = `You are VibeCode AI, an expert coding assistant integrated into a futuristic IDE. 
Your goal is to help the user write clean, modern, and efficient code.
When providing code, wrap it in markdown code blocks with the language specified.
Be concise, helpful, and "vibey" - professional but modern and slightly enthusiastic.
If the user asks to modify the current file, provide the full updated code block so they can apply it.
You have access to the project structure and contents when the user enables full context. Use this to understand dependencies and imports.`;

function App() {
  const [files, setFiles] = useState<File[]>(INITIAL_FILES);
  const [deletedFiles, setDeletedFiles] = useState<File[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>(''); 
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeSidebarView, setActiveSidebarView] = useState<'explorer' | 'git' | null>('explorer');
  const [projectHandle, setProjectHandle] = useState<any>(null); // For File System Access API
  
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const [contextScope, setContextScope] = useState<'project' | 'file'>('project');

  const [stagedFileIds, setStagedFileIds] = useState<string[]>([]);
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

  const chatSessionRef = useRef<Chat | null>(null);
  const messagesRef = useRef(messages);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorPosRef = useRef(0);
  const activeFileIdRef = useRef(activeFileId);
  const lastContentRef = useRef<string>('');
  const lastActiveFileIdForEffect = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem('vibe_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

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
      const history: Content[] = messagesRef.current
        .filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL)
        .map(m => ({
          role: m.role as 'user' | 'model',
          parts: [{ text: m.text }]
        }));

      chatSessionRef.current = createChatSession(SYSTEM_INSTRUCTION, history);
      addTerminalLine('System initialized. VibeCode AI connected.', 'info');
    } catch (e) {
      addTerminalLine('Failed to initialize AI session.', 'error');
    }
  }, [addTerminalLine]);

  // Init Linter
  useEffect(() => {
    initRuff().then(() => {
      console.log('Ruff Linter initialized');
    });
    initChat();
  }, [initChat]);

  const activeFile = files.find(f => f.id === activeFileId && f.type === 'file') || null;

  // --- File System Access API ---
  const handleOpenFolder = async () => {
    try {
      // @ts-ignore - window.showDirectoryPicker is not yet in all TS definitions
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      
      addTerminalLine(`Opening local directory: ${dirHandle.name}...`, 'command');
      setIsGenerating(true); 

      const loadedFiles = await processDirectoryHandle(dirHandle);
      
      setFiles(loadedFiles);
      setProjectHandle(dirHandle);
      setActiveFileId('');
      setOpenFileIds([]);
      setStagedFileIds([]);
      setDeletedFiles([]);
      setCommits([]);
      
      addTerminalLine(`Loaded project: ${dirHandle.name} with ${loadedFiles.length} items.`, 'success');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         addTerminalLine(`Error opening folder: ${err.message}`, 'error');
      }
    } finally {
      setIsGenerating(false);
    }
  };
  // -----------------------------

  const getFilePath = useCallback((file: File): string => {
    let path = file.name;
    let current = file;
    let depth = 0;
    while (current.parentId && depth < 10) { 
        const parent = files.find(f => f.id === current.parentId);
        if (parent) {
            path = `${parent.name}/${path}`;
            current = parent;
        } else {
            break;
        }
        depth++;
    }
    return path;
  }, [files]);

  const getProjectContext = useCallback(() => {
     const structure = files.map(f => {
        const path = getFilePath(f);
        return `${f.type === 'folder' ? '[DIR]' : '[FILE]'} ${path}`;
     }).sort().join('\n');

     const contents = files
        .filter(f => f.type === 'file')
        .map(f => `
// --- START OF FILE: ${getFilePath(f)} ---
${f.content}
// --- END OF FILE: ${getFilePath(f)} ---
        `).join('\n');
     
     return `PROJECT STRUCTURE:\n${structure}\n\nPROJECT FILES CONTENT:\n${contents}`;
  }, [files, getFilePath]);

  const getPreviewContent = useMemo(() => {
    if (!isPreviewOpen) return '';

    let rootHtmlFile = activeFile?.language === 'html' ? activeFile : files.find(f => f.name === 'index.html');
    
    if (!rootHtmlFile) {
        rootHtmlFile = files.find(f => f.language === 'html');
    }

    if (!rootHtmlFile) {
        return `
            <html>
                <body style="background-color: #ffffff; color: #64748b; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                    <div style="text-align: center;">
                        <h3 style="margin-bottom: 0.5rem;">No HTML Entry Point Found</h3>
                        <p style="font-size: 0.875rem;">Create an index.html file to enable Live Preview.</p>
                    </div>
                </body>
            </html>
        `;
    }

    let html = rootHtmlFile.content;

    const stripTypes = (code: string) => {
        return code
            .replace(/:\s*[a-zA-Z0-9_<>\[\]]+/g, '') 
            .replace(/<[a-zA-Z0-9_,\s]+>/g, ''); 
    };

    html = html.replace(/<link[^>]*href=["']([^"']+)["'][^>]*>/g, (match, href) => {
        if (href.includes('http')) return match; 
        
        const filename = href.split('/').pop();
        const cssFile = files.find(f => f.name === filename);
        if (cssFile) {
            return `<style>\n/* Injected from ${filename} */\n${cssFile.content}\n</style>`;
        }
        return match;
    });

    html = html.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g, (match, src) => {
        if (src.includes('http')) return match;

        const filename = src.split('/').pop();
        const jsFile = files.find(f => f.name === filename);
        if (jsFile) {
            let content = jsFile.content;
            if (jsFile.language === 'typescript') {
                content = stripTypes(content);
            }
            return `<script>\n// Injected from ${filename}\n${content}\n</script>`;
        }
        return match;
    });

    return html;
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

  const handleFileChange = (newContent: string, forceHistory: boolean = false) => {
    setFiles(prev => prev.map(f => {
        if (f.id !== activeFileId) return f;
        
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
    setSuggestion(null);

    // Trigger Linting if Python
    if (activeFile?.language === 'python') {
        if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
        lintTimerRef.current = setTimeout(() => {
            const diags = runPythonLint(newContent);
            setDiagnostics(diags);
        }, 500);
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
  
  const handleSelectionChange = (selection: string) => {
    setSelectedCode(selection);
  };

  const handleExplainSelection = () => {
    if (!selectedCode) return;
    setIsAIOpen(true);
    handleSendMessage(`Explain the following code snippet:\n\n\`\`\`${activeFile?.language || 'text'}\n${selectedCode}\n\`\`\``);
  };

  const handleGitStage = (fileId: string) => {
    if (!stagedFileIds.includes(fileId)) {
        setStagedFileIds(prev => [...prev, fileId]);
    }
  };

  const handleGitUnstage = (fileId: string) => {
    setStagedFileIds(prev => prev.filter(id => id !== fileId));
  };

  const handleGitCommit = (message: string) => {
    const timestamp = Date.now();
    
    // Process modified/added files
    const stagedFilesList = files.filter(f => stagedFileIds.includes(f.id));
    
    setFiles(prev => prev.map(f => {
        if (stagedFileIds.includes(f.id)) {
            return { ...f, committedContent: f.content };
        }
        return f;
    }));

    // Process deleted files
    const stagedDeletions = deletedFiles.filter(f => stagedFileIds.includes(f.id));
    setDeletedFiles(prev => prev.filter(f => !stagedFileIds.includes(f.id)));

    const newCommit: Commit = {
        id: Math.random().toString(36).slice(2, 11),
        message,
        timestamp,
        author: 'User',
        stats: {
            added: stagedFilesList.filter(f => !f.committedContent).length,
            modified: stagedFilesList.filter(f => f.committedContent).length,
            deleted: stagedDeletions.length
        }
    };

    setCommits(prev => [...prev, newCommit]);
    setStagedFileIds([]);
    addTerminalLine(`Commit ${newCommit.id.slice(0, 7)}: ${message}`, 'success');
  };

  const fetchCodeSuggestion = useCallback(async (isAuto: boolean = false) => {
    if (!activeFile || isGenerating || isFetchingSuggestion) return;
    
    if (activeFile.id !== activeFileIdRef.current) return;

    setIsFetchingSuggestion(true);
    if (!isAuto) addTerminalLine('Fetching suggestion...', 'info');
    
    try {
        const context = getProjectContext();
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
  }, [activeFile, isGenerating, isFetchingSuggestion, getProjectContext, addTerminalLine]);

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

  const handleCreateNode = async (type: 'file' | 'folder', parentId: string | null = null, name: string) => {
    if (files.some(f => f.parentId === parentId && f.name === name)) {
        addTerminalLine(`Error: ${type} "${name}" already exists in this location.`, 'error');
        return;
    }

    let handle: any = undefined;
    
    // File System Access API Create
    if (projectHandle) {
        try {
            let parentHandle = projectHandle;
            if (parentId) {
                const parentFile = files.find(f => f.id === parentId);
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
      content: type === 'file' ? (type === 'file' && getLanguage(name) === 'python' ? '# Python File\n' : '// Start coding...') : '',
      isModified: type === 'file',
      history: type === 'file' ? { past: [], future: [], lastSaved: 0 } : undefined,
      handle: handle
    };
    
    setFiles(prev => [...prev, newFile]);
    
    if (type === 'file') {
        setOpenFileIds(prev => [...prev, newFile.id]);
        setActiveFileId(newFile.id);
        setSelectedCode('');
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

      setFiles(prev => prev.map(f => {
          if (f.id === id) {
              return { ...f, name: newName, language: f.type === 'file' ? getLanguage(newName) : f.language };
          }
          return f;
      }));
      addTerminalLine(`Renamed to ${newName}`, 'info');
  };

  const handleSave = async () => {
    // File System Access API Save
    const file = files.find(f => f.id === activeFileId);
    if (file && file.handle) {
        try {
            const writable = await file.handle.createWritable();
            await writable.write(file.content);
            await writable.close();
            addTerminalLine(`Written to disk: ${file.name}`, 'info');
        } catch (err) {
            addTerminalLine(`Error saving to disk: ${err}`, 'error');
            return;
        }
    }

    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, isModified: false } : f
    ));
    addTerminalLine(`Saved file: ${activeFile?.name}`, 'success');
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
             // Recursive delete for folders, simple for files
             await parentHandle.removeEntry(fileToDelete.name, { recursive: fileToDelete.type === 'folder' });
         } catch (e) {
             addTerminalLine(`FS Delete Error: ${e}`, 'error');
             return;
         }
    }

    const idsToDelete = [fileToDelete.id, ...getDescendantIds(fileToDelete.id, files)];
    
    // Capture files to be deleted for Git tracking before removing them
    const filesBeingDeleted = files.filter(f => idsToDelete.includes(f.id));
    
    // Only track deletions for files that were previously committed
    const trackedDeletions = filesBeingDeleted.filter(f => f.type === 'file' && f.committedContent !== undefined);
    
    if (trackedDeletions.length > 0) {
        setDeletedFiles(prev => [...prev, ...trackedDeletions]);
    }
    
    const newFiles = files.filter(f => !idsToDelete.includes(f.id));
    setFiles(newFiles);

    const newOpenIds = openFileIds.filter(id => !idsToDelete.includes(id));
    setOpenFileIds(newOpenIds);
    
    // Unstage deleted files if they were staged as modified/added
    setStagedFileIds(prev => prev.filter(id => !idsToDelete.includes(id)));

    if (activeFileId && idsToDelete.includes(activeFileId)) {
        if (newOpenIds.length > 0) {
            setActiveFileId(newOpenIds[newOpenIds.length - 1]);
        } else {
            setActiveFileId('');
        }
    }
    
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
          const context = getProjectContext();
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

    } catch (error) {
      addTerminalLine('Error communicating with AI service.', 'error');
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.SYSTEM,
        text: "Error: Could not connect to AI. Please check your API key in Settings.",
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
    <div className="flex h-screen w-screen bg-vibe-900 text-slate-300 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <div className="w-12 flex flex-col items-center py-4 bg-vibe-900 border-r border-white/5 gap-4 z-30">
        <button 
          onClick={() => setActiveSidebarView(activeSidebarView === 'explorer' ? null : 'explorer')}
          className={`p-2 rounded-xl transition-all ${activeSidebarView === 'explorer' ? 'bg-vibe-accent text-white shadow-lg shadow-vibe-accent/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
          title="File Explorer (Cmd+B)"
        >
          <IconFileCode size={20} />
        </button>
        <button 
          onClick={() => setActiveSidebarView(activeSidebarView === 'git' ? null : 'git')}
          className={`p-2 rounded-xl transition-all ${activeSidebarView === 'git' ? 'bg-vibe-accent text-white shadow-lg shadow-vibe-accent/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
          title="Source Control"
        >
          <div className="relative">
             <IconGitBranch size={20} />
             {stagedFileIds.length > 0 && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-vibe-900"></div>
             )}
          </div>
        </button>
        <button 
          onClick={() => setIsCommandPaletteOpen(true)}
          className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          title="Command Palette (Cmd+P)"
        >
          <IconSearch size={20} />
        </button>
        
        <div className="flex-1" />
        
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          title="Settings"
        >
          <IconSettings size={20} />
        </button>
      </div>

      {/* Sidebar Panel */}
      {activeSidebarView && (
        <div className="w-64 bg-vibe-800/50 border-r border-white/5 flex flex-col animate-in slide-in-from-left-5 duration-200">
           {activeSidebarView === 'explorer' && (
             <>
               <div className="p-4 flex items-center justify-between border-b border-white/5 h-14">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Explorer</span>
                  <div className="flex items-center gap-1">
                      <button onClick={handleCreateRootFile} className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white"><IconFilePlus size={14} /></button>
                      <button onClick={handleOpenFolder} className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white"><IconFolderOpen size={14} /></button>
                  </div>
               </div>
               <FileExplorer 
                  files={files} 
                  activeFileId={activeFileId} 
                  onFileClick={handleFileClick}
                  onDelete={(f) => setFileToDelete(f)}
                  onRename={handleRenameNode}
                  onCreate={handleCreateNode}
                  onToggleFolder={handleToggleFolder}
               />
             </>
           )}
           {activeSidebarView === 'git' && (
             <GitPanel 
                files={files}
                deletedFiles={deletedFiles}
                stagedFileIds={stagedFileIds}
                commits={commits}
                onStage={handleGitStage}
                onUnstage={handleGitUnstage}
                onCommit={handleGitCommit}
             />
           )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-vibe-900 relative">
        
        {/* Editor Tabs & Header */}
        <div className="h-14 flex items-center justify-between bg-vibe-900 border-b border-white/5 px-2 select-none">
           <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[calc(100%-200px)]">
              {openFileIds.map(id => {
                 const file = files.find(f => f.id === id);
                 if (!file) return null;
                 const isActive = activeFileId === id;
                 return (
                   <div 
                      key={id}
                      onClick={() => { setActiveFileId(id); setSelectedCode(''); }}
                      className={`
                        group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer border border-transparent transition-all min-w-[120px] max-w-[200px]
                        ${isActive ? 'bg-vibe-800 border-white/10 text-white shadow-sm' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}
                      `}
                   >
                      <span className={`${isActive ? 'text-vibe-glow' : 'opacity-70'}`}>
                         {file.language === 'python' ? '🐍' : <IconFileCode size={14} />}
                      </span>
                      <span className="text-xs truncate flex-1">{file.name}</span>
                      {file.isModified && <div className="w-1.5 h-1.5 rounded-full bg-vibe-accent"></div>}
                      <button 
                        onClick={(e) => handleCloseTab(e, id)}
                        className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded ${isActive ? 'text-slate-400 hover:text-white' : ''}`}
                      >
                        <IconClose size={12} />
                      </button>
                   </div>
                 )
              })}
           </div>

           <div className="flex items-center gap-2 pr-2">
              <button 
                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isPreviewOpen ? 'bg-vibe-accent text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
              >
                 {isPreviewOpen ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                 <span className="hidden sm:inline">Preview</span>
              </button>
              <button 
                onClick={() => runCode()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all text-xs font-medium"
              >
                 <IconPlay size={14} />
                 <span className="hidden sm:inline">Run</span>
              </button>
              <button 
                onClick={() => setIsAIOpen(!isAIOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-medium border ${isAIOpen ? 'bg-vibe-accent text-white border-vibe-accent' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'}`}
              >
                 <IconSparkles size={14} />
                 <span className="hidden sm:inline">AI Assistant</span>
              </button>
           </div>
        </div>

        {/* Editor & Content */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
            {activeFile ? (
               <div className="flex-1 relative">
                  <CodeEditor 
                     code={activeFile.content}
                     language={activeFile.language}
                     onChange={handleFileChange}
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
                  
                  {/* Floating Action Bar for Selection */}
                  {selectedCode && (
                     <div className="absolute top-4 right-8 z-40 animate-in fade-in slide-in-from-top-2">
                        <button 
                          onClick={handleExplainSelection}
                          className="flex items-center gap-2 px-3 py-1.5 bg-vibe-accent text-white rounded-full shadow-lg hover:bg-indigo-500 transition-transform hover:scale-105 text-xs font-medium"
                        >
                           <IconSparkles size={14} />
                           Explain Selection
                        </button>
                     </div>
                  )}
               </div>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-600 bg-[#0a0a0f]">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                     <IconCommand size={32} />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Open a file to start coding</p>
                  <p className="text-xs mt-2 opacity-50">Cmd+P to search files</p>
               </div>
            )}

            {/* Terminal Panel */}
            <div className={`transition-all duration-300 border-t border-white/10 ${isTerminalOpen ? 'h-48' : 'h-0 overflow-hidden'}`}>
                <Terminal 
                  lines={terminalLines} 
                  isOpen={isTerminalOpen} 
                  diagnostics={diagnostics}
                  onSelectDiagnostic={(line, col) => {
                      if (activeFile) {
                          // Simple jump logic could be implemented here by setting cursor
                          // For now we just log
                          console.log(`Jump to ${line}:${col}`);
                      }
                  }}
                />
            </div>
        </div>

      </div>

      {/* Overlays */}
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
      />

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
