

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  IconTerminal, IconPlay, IconFilePlus, IconFolderOpen, IconSparkles, 
  IconGitBranch, IconSettings, IconClose
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
import CloneModal from './components/CloneModal';

import { createChatSession, sendMessageStream, getCodeCompletion, editCode } from './services/geminiService';
import { initRuff, runPythonLint } from './services/lintingService';
import { gitService } from './services/gitService';
import { projectService } from './services/projectService';
import { ragService } from './services/ragService';
import { File, Message, MessageRole, TerminalLine, Diagnostic, AISession, ProjectMeta } from './types';
import { getFilePath, resolveFileByPath, generateProjectStructureContext } from './utils/fileUtils';
import { generatePreviewHtml } from './utils/previewUtils';
import { useFileSystem } from './hooks/useFileSystem';
import { useGit } from './hooks/useGit';

const SYSTEM_INSTRUCTION = `You are VibeCode AI, an expert coding assistant integrated into a futuristic IDE. 
Your goal is to help the user write clean, modern, and efficient code.
When providing code, wrap it in markdown code blocks with the language specified.
Be concise, helpful, and "vibey" - professional but modern and slightly enthusiastic.
If the user asks to modify the current file, provide the full updated code block so they can apply it.
You have access to the project structure and contents when the user enables full context. Use this to understand dependencies and imports.`;

function App() {
  // --- UI State ---
  const [activeSidebarView, setActiveSidebarView] = useState<'explorer' | 'git' | null>(() => {
      try { return JSON.parse(localStorage.getItem('vibe_layout_sidebar') || '"explorer"'); } catch { return 'explorer'; }
  });
  const [isTerminalOpen, setIsTerminalOpen] = useState(() => {
      try { return JSON.parse(localStorage.getItem('vibe_layout_terminal') || 'true'); } catch { return true; }
  });
  const [contextScope, setContextScope] = useState<'project' | 'file'>(() => 
      (localStorage.getItem('vibe_context_scope') as 'project' | 'file') || 'project'
  );
  
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const addTerminalLine = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
    setTerminalLines(prev => [...prev, { id: Math.random().toString(36).slice(2, 11), text, type, timestamp: Date.now() }]);
  }, []);

  // --- Core Hooks ---
  const fs = useFileSystem(addTerminalLine);
  const git = useGit(fs.files, addTerminalLine);

  // --- Project Management State ---
  const [activeProject, setActiveProject] = useState<ProjectMeta | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([]);
  const debounceSaveProjectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Editor State ---
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('vibe_chat_history');
      return saved ? JSON.parse(saved).map((m: Message) => ({ ...m, isStreaming: false })) : [];
    } catch { return []; }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<File | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  
  // Refs & Timers
  const lintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceIndexRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatSessionRef = useRef<AISession | null>(null);
  const messagesRef = useRef(messages);
  const lastCursorPosRef = useRef(0);
  const activeFileIdRef = useRef(fs.activeFileId);
  const lastContentRef = useRef<string>('');
  const lastActiveFileIdForEffect = useRef<string | null>(null);
  const filesRef = useRef(fs.files);

  // --- Effects ---
  useEffect(() => { filesRef.current = fs.files; }, [fs.files]);
  useEffect(() => { activeFileIdRef.current = fs.activeFileId; }, [fs.activeFileId]);
  useEffect(() => { 
      messagesRef.current = messages; 
      localStorage.setItem('vibe_chat_history', JSON.stringify(messages));
  }, [messages]);
  useEffect(() => { localStorage.setItem('vibe_layout_sidebar', JSON.stringify(activeSidebarView)); }, [activeSidebarView]);
  useEffect(() => { localStorage.setItem('vibe_layout_terminal', JSON.stringify(isTerminalOpen)); }, [isTerminalOpen]);
  useEffect(() => { localStorage.setItem('vibe_context_scope', contextScope); }, [contextScope]);

  // RAG Indexing Effect
  useEffect(() => {
    if (debounceIndexRef.current) clearTimeout(debounceIndexRef.current);
    debounceIndexRef.current = setTimeout(() => {
      if (fs.files.length > 0) {
        setIsIndexing(true);
        addTerminalLine('Building smart context index...', 'info');
        ragService.updateIndex(fs.files).then(() => {
          setIsIndexing(false);
          addTerminalLine('Smart context ready.', 'success');
        });
      }
    }, 2000); // Debounce for 2s
  }, [fs.files, addTerminalLine]);


  // Load active project on mount
  useEffect(() => {
    setRecentProjects(projectService.getRecents());
    const lastProjectId = projectService.getActiveProjectId();
    
    if (lastProjectId) {
      const recents = projectService.getRecents();
      const meta = recents.find(p => p.id === lastProjectId);
      if (meta) {
        const savedFiles = projectService.loadProject(lastProjectId);
        if (savedFiles) {
           fs.setAllFiles(savedFiles);
           setActiveProject(meta);
           addTerminalLine(`Loaded project: ${meta.name}`, 'info');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save project files
  useEffect(() => {
    if (!activeProject) return;

    if (debounceSaveProjectRef.current) clearTimeout(debounceSaveProjectRef.current);
    debounceSaveProjectRef.current = setTimeout(() => {
      projectService.saveProject(fs.files, activeProject);
      // Update recents list to reflect new lastOpened time or order if changed
      setRecentProjects(projectService.getRecents());
    }, 2000);

    return () => {
       if (debounceSaveProjectRef.current) clearTimeout(debounceSaveProjectRef.current);
    };
  }, [fs.files, activeProject]);

  // Init Services
  useEffect(() => {
    initRuff().then(() => console.log('Ruff Linter initialized'));
    initChat();
  }, []);

  const initChat = useCallback(() => {
      const history = messagesRef.current.filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL);
      chatSessionRef.current = createChatSession(SYSTEM_INSTRUCTION, history);
      addTerminalLine('System initialized. VibeCode AI connected.', 'info');
  }, [addTerminalLine]);

  // --- Handlers ---

  const handleNewProject = async () => {
      // Prompt for name
      const name = window.prompt("Enter project name:", "Untitled Project");
      if (!name) return;

      // Save current if active
      if (activeProject) {
        projectService.saveProject(fs.files, activeProject);
      }

      // Create new
      const newMeta = projectService.createProject(name);
      setActiveProject(newMeta);
      setRecentProjects(projectService.getRecents()); // Update list with new one
      
      fs.resetProject();
      git.reset();
      setMessages([]);
      setTerminalLines([]);
      addTerminalLine(`New project created: ${name}`, 'success');
  };

  const handleLoadProject = async (project: ProjectMeta) => {
    if (activeProject?.id === project.id) return;
    
    // Save current
    if (activeProject) {
       projectService.saveProject(fs.files, activeProject);
    }

    // Load new
    const files = projectService.loadProject(project.id);
    if (files) {
       fs.setAllFiles(files);
       setActiveProject(project);
       projectService.saveProject(files, project); // Bump timestamp
       setRecentProjects(projectService.getRecents());
       
       git.reset(); // Reset git state as we switched context
       // Optional: Try to re-init git if we had persistent .git storage
       
       addTerminalLine(`Switched to project: ${project.name}`, 'info');
    } else {
       addTerminalLine(`Failed to load project: ${project.name}`, 'error');
    }
  };

  const handleClone = async (url: string) => {
      setIsCloneModalOpen(false);
      
      // If no active project, create one derived from URL
      if (!activeProject) {
          const name = url.split('/').pop()?.replace('.git', '') || 'Cloned Repo';
          const newMeta = projectService.createProject(name);
          setActiveProject(newMeta);
      } else {
          // If active project is empty, use it. If not, maybe warn? 
          // Current behavior: overwrite active project.
          addTerminalLine(`Overwriting current project with clone...`, 'warning');
      }

      const newFiles = await git.clone(url);
      if (newFiles) {
          fs.setAllFiles(newFiles);
          git.refresh();
      }
  };

  const handleSaveAll = async () => {
      const modified = fs.files.filter(f => f.isModified);
      for (const f of modified) {
          await fs.saveFile(f);
          await git.syncFile(f);
      }
      if (activeProject) {
         projectService.saveProject(fs.files, activeProject);
      }
      if (modified.length > 0) addTerminalLine(`Saved ${modified.length} files.`, 'success');
  };

  const handleFileClick = (file: File) => {
    fs.selectFile(file);
    if (file.type === 'file') {
        setSelectedCode('');
        if (file.language === 'python') {
             setDiagnostics(runPythonLint(file.content));
        } else {
             setDiagnostics([]);
        }
    }
  };

  const handleConfirmDelete = async () => {
      if (!fileToDelete) return;
      const ids = await fs.deleteNode(fileToDelete);
      if (fileToDelete.type === 'file') await git.deleteFile(fileToDelete);
      setFileToDelete(null);
  };

  const handleAgentAction = useCallback(async (action: string, args: any): Promise<string> => {
      const currentFiles = filesRef.current;
      switch (action) {
          case 'listFiles':
             return currentFiles.map(f => `${f.type === 'folder' ? '[DIR]' : '[FILE]'} ${getFilePath(f, currentFiles)}`).sort().join('\n');
          case 'readFile': {
             const file = resolveFileByPath(args.path, currentFiles);
             return file ? (file.type === 'file' ? file.content : "Error: Is a folder") : `Error: File not found ${args.path}`;
          }
          case 'writeFile': {
             const { path, content } = args;
             const existing = resolveFileByPath(path, currentFiles);
             if (existing) {
                 fs.updateFileContent(content, true, existing.id);
                 return `Updated: ${existing.name}`;
             } else {
                 const name = path.split('/').pop() || 'untitled';
                 fs.createNode('file', null, name, content);
                 return `Created: ${name}`;
             }
          }
          case 'runCommand':
              addTerminalLine(`Agent: ${args.command}`, 'command');
              return `Executed: ${args.command}`;
          default: return `Unknown tool: ${action}`;
      }
  }, [fs, addTerminalLine]);

  // --- Auto-complete & Linting Side Effects ---
  useEffect(() => {
    if (!fs.activeFile) return;

    // Linting on content change
    if (fs.activeFile.content !== lastContentRef.current) {
        lastContentRef.current = fs.activeFile.content;
        setSuggestion(null);
        
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(async () => {
            if (fs.activeFile?.language === 'python') {
                setDiagnostics(runPythonLint(fs.activeFile.content));
            }
            // Auto Suggestion
            if (!isGenerating && !suggestion && !isIndexing) {
                try {
                    const sugg = await getCodeCompletion(fs.activeFile.content, lastCursorPosRef.current, fs.activeFile.language, fs.activeFile, fs.files);
                    if (sugg) setSuggestion(sugg);
                } catch(e) {}
            }
        }, 1000);
    }
    
    // File Switch
    if (fs.activeFile.id !== lastActiveFileIdForEffect.current) {
        lastActiveFileIdForEffect.current = fs.activeFile.id;
        lastContentRef.current = fs.activeFile.content;
        setSuggestion(null);
    }
  }, [fs.activeFile, fs.files, isGenerating, suggestion, isIndexing]);

  const handleSendMessage = async (text: string) => {
    if (!chatSessionRef.current) return;
    const userMsg: Message = { id: Date.now().toString(), role: MessageRole.USER, text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      let prompt = text;
      if (contextScope === 'project') {
          const context = ragService.getContext(text, fs.activeFile, fs.files);
          prompt = `[SMART CONTEXT]\n${context}\n\n[QUERY]\n${text}`;
      } else if (fs.activeFile) {
          prompt = `[FILE: ${fs.activeFile.name}]\n${fs.activeFile.content}\n\n[QUERY]\n${text}`;
      }

      const stream = await sendMessageStream(chatSessionRef.current, prompt);
      const responseId = (Date.now() + 1).toString();
      setMessages(p => [...p, { id: responseId, role: MessageRole.MODEL, text: '', timestamp: Date.now(), isStreaming: true }]);

      let fullText = '';
      for await (const chunk of stream) {
        if (chunk.text) {
            fullText += chunk.text;
            setMessages(p => p.map(m => m.id === responseId ? { ...m, text: fullText } : m));
        }
      }
      setMessages(p => p.map(m => m.id === responseId ? { ...m, isStreaming: false } : m));
    } catch (error: any) {
      addTerminalLine('AI Error', 'error');
    } finally { setIsGenerating(false); }
  };

  const handleInlineAssist = async (instruction: string, range: any) => {
      if (!fs.activeFile) return;
      const file = fs.activeFile;
      
      try {
          // Monaco ranges are 1-based, we use offset based splitting usually or line splitting.
          // range: { startLineNumber, startColumn, endLineNumber, endColumn }
          
          // Let's rely on splitting by lines which is robust enough for now.
          const lines = file.content.split('\n');
          const startLine = range.startLineNumber - 1;
          const endLine = range.endLineNumber - 1;
          const startCol = range.startColumn - 1;
          const endCol = range.endColumn - 1;

          // Extract prefix (up to start)
          let prefix = "";
          for(let i=0; i<startLine; i++) prefix += lines[i] + "\n";
          prefix += lines[startLine].substring(0, startCol);

          // Extract suffix (from end)
          let suffix = lines[endLine].substring(endCol) + "\n";
          for(let i=endLine+1; i<lines.length; i++) suffix += lines[i] + "\n";
          
          // Extract selection
          let selectedText = "";
          if (startLine === endLine) {
              selectedText = lines[startLine].substring(startCol, endCol);
          } else {
              selectedText = lines[startLine].substring(startCol) + "\n";
              for(let i=startLine+1; i<endLine; i++) selectedText += lines[i] + "\n";
              selectedText += lines[endLine].substring(0, endCol);
          }

          const newCode = await editCode(prefix, selectedText, suffix, instruction, fs.activeFile, fs.files);
          
          if (newCode) {
              const updatedContent = prefix + newCode + suffix;
              fs.updateFileContent(updatedContent);
              addTerminalLine('Inline Edit Applied', 'success');
          }

      } catch (e) {
          console.error(e);
          addTerminalLine('Inline Edit Failed', 'error');
      }
  };

  const handleRunCode = () => {
      if (!fs.activeFile) return;
      addTerminalLine(`Running ${fs.activeFile.name}...`, 'command');
      if (['javascript','typescript'].includes(fs.activeFile.language)) {
          try {
             const originalLog = console.log;
             console.log = (...args) => { addTerminalLine(args.map(a => JSON.stringify(a)).join(' ')); originalLog(...args); };
             // eslint-disable-next-line no-eval
             eval(fs.activeFile.content);
             console.log = originalLog;
          } catch(e:any) { addTerminalLine(`Error: ${e.message}`, 'error'); }
      } else if (fs.activeFile.language === 'html') {
          setIsPreviewOpen(true);
      } else { addTerminalLine('Execution not supported in browser.', 'warning'); }
  };

  // --- Render ---
  const activeFile = fs.activeFile;
  const getPreviewContent = useMemo(() => isPreviewOpen ? generatePreviewHtml(fs.files, activeFile) : '', [fs.files, activeFile, isPreviewOpen]);

  return (
    <div className="flex flex-col h-screen w-screen text-slate-300 font-sans overflow-hidden bg-transparent">
      
      <MenuBar 
        onNewProject={handleNewProject}
        onSaveAll={handleSaveAll}
        projectName={activeProject?.name || (fs.files.length > 0 ? "Draft Workspace" : undefined)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCloneModal={() => setIsCloneModalOpen(true)}
        recentProjects={recentProjects}
        onLoadProject={handleLoadProject}
      />

      {/* Main Workspace Area with Floating "Islands" */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        
        {/* Floating Sidebar */}
        <div className="flex flex-col gap-3 h-full">
           <Sidebar 
            activeView={activeSidebarView} 
            setActiveView={setActiveSidebarView} 
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            gitStatus={git.status}
          />
          
          {/* Expanded Sidebar Panel (Explorer/Git) */}
          {activeSidebarView && (
            <div className="w-64 glass-panel rounded-2xl flex flex-col animate-in slide-in-from-left-4 duration-300 h-full overflow-hidden shadow-2xl">
               {activeSidebarView === 'explorer' && (
                 <div className="flex flex-col h-full">
                    <div className="p-4 text-xs font-bold text-slate-500 uppercase flex justify-between tracking-wider border-b border-white/5">
                      <span>Explorer</span>
                      <button onClick={() => fs.createNode('file', null, `untitled_${fs.files.length}.ts`)} className="hover:text-white transition-colors"><IconFilePlus size={14} /></button>
                    </div>
                    {fs.files.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 opacity-50 space-y-3">
                            <IconFolderOpen size={32} />
                            <p className="text-xs">No files</p>
                            <button onClick={() => setIsCloneModalOpen(true)} className="text-vibe-accent text-xs hover:underline">Clone Repo</button>
                        </div>
                    ) : (
                        <FileExplorer 
                          files={fs.files} activeFileId={fs.activeFileId} onFileClick={handleFileClick}
                          onDelete={setFileToDelete} onRename={fs.renameNode} onCreate={fs.createNode} onToggleFolder={fs.toggleFolder}
                        />
                    )}
                 </div>
               )}
               {activeSidebarView === 'git' && (
                   <GitPanel 
                      isInitialized={git.isInitialized} files={fs.files} gitStatus={git.status} commits={git.commits}
                      onStage={git.stage} onUnstage={git.unstage} onCommit={git.commit} onInitialize={() => git.init(fs.files)}
                      onClone={handleClone} isCloning={git.isCloning}
                   />
               )}
            </div>
          )}
        </div>

        {/* Main Editor Island */}
        <div className="flex-1 flex flex-col min-w-0 relative gap-3">
           {/* Tab Bar */}
           <div className="shrink-0">
               <EditorTabs 
                  openFileIds={fs.openFileIds} activeFileId={fs.activeFileId} files={fs.files} setActiveFileId={fs.setActiveFileId}
                  onCloseTab={(e, id) => { e.stopPropagation(); fs.closeFile(id); }} onClearSelection={() => setSelectedCode('')}
                  isPreviewOpen={isPreviewOpen} setIsPreviewOpen={setIsPreviewOpen} isAIOpen={isAIOpen} setIsAIOpen={setIsAIOpen} onRunCode={handleRunCode}
               />
           </div>

           {/* Editor Container */}
           <div className="flex-1 relative overflow-hidden rounded-2xl glass-panel shadow-2xl flex flex-col">
               {activeFile ? (
                   <>
                       <div className="flex-1 relative overflow-hidden">
                           <CodeEditor 
                               code={activeFile.content} language={activeFile.language}
                               onChange={(c) => fs.updateFileContent(c)}
                               cursorOffset={cursorPosition} onCursorChange={(p) => { setCursorPosition(p); lastCursorPosRef.current = p; }}
                               onSelectionChange={setSelectedCode} suggestion={suggestion}
                               onAcceptSuggestion={() => { if(suggestion) { fs.updateFileContent(activeFile.content.slice(0, cursorPosition) + suggestion + activeFile.content.slice(cursorPosition)); setSuggestion(null); } }}
                               onUndo={fs.undo} onRedo={fs.redo} showPreview={isPreviewOpen} previewContent={getPreviewContent} diagnostics={diagnostics}
                               onInlineAssist={handleInlineAssist}
                           />
                           
                           {/* Floating Context Bar */}
                           {selectedCode && (
                              <div className="absolute bottom-8 right-8 z-40 animate-in slide-in-from-bottom-4 duration-300">
                                  <ContextBar language={activeFile.language} onAction={(act) => { setIsAIOpen(true); handleSendMessage(`${act} the selected code:\n\`\`\`\n${selectedCode}\n\`\`\``); }} />
                              </div>
                           )}
                       </div>
                   </>
               ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4 bg-gradient-to-b from-transparent to-black/20">
                       <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 animate-float shadow-xl backdrop-blur-sm">
                          <IconSparkles size={40} className="text-vibe-glow opacity-60" />
                       </div>
                       <p className="text-sm font-medium tracking-wide">Select a file to start vibing</p>
                       <p className="text-xs opacity-50">Cmd+P to search files</p>
                   </div>
               )}
               
               {/* AI Panel Overlay - Floating */}
               <AIPanel 
                  isOpen={isAIOpen} messages={messages} onSendMessage={handleSendMessage} isGenerating={isGenerating}
                  activeFile={activeFile} onClose={() => setIsAIOpen(false)}
                  onApplyCode={(c) => fs.updateFileContent(c, true)}
                  onInsertCode={(c) => fs.updateFileContent(activeFile!.content.slice(0, cursorPosition) + c + activeFile!.content.slice(cursorPosition), true)}
                  contextScope={contextScope} setContextScope={setContextScope} files={fs.files} onAgentAction={handleAgentAction}
               />
           </div>

           {/* Terminal Panel (Collapsible) */}
           <div className={`transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] glass-panel rounded-2xl overflow-hidden ${isTerminalOpen ? 'h-48 shadow-xl' : 'h-10 opacity-80 hover:opacity-100'}`}>
              {isTerminalOpen ? (
                   <div className="h-full flex flex-col relative">
                       <button onClick={() => setIsTerminalOpen(false)} className="absolute top-3 right-4 text-slate-500 hover:text-white z-20"><IconClose size={14}/></button>
                       <Terminal lines={terminalLines} isOpen={true} diagnostics={diagnostics} />
                   </div>
              ) : (
                   <div className="h-full flex items-center px-4 cursor-pointer hover:bg-white/5 transition-colors justify-between" onClick={() => setIsTerminalOpen(true)}>
                       <div className="flex items-center gap-3">
                          <IconTerminal size={14} className="text-slate-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Terminal</span>
                       </div>
                       {(diagnostics.length > 0 || isIndexing) && (
                          <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full ${isIndexing ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                             <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isIndexing ? 'bg-blue-400' : 'bg-red-500'}`} />
                             <span className={`text-[10px] font-medium ${isIndexing ? 'text-blue-300' : 'text-red-400'}`}>
                                 {isIndexing ? 'Indexing...' : `${diagnostics.length} Problems`}
                              </span>
                          </div>
                       )}
                   </div>
              )}
           </div>
        </div>
      </div>

      {/* Modals */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onKeyUpdate={initChat} />
      <DeleteConfirmModal isOpen={!!fileToDelete} fileName={fileToDelete?.name || ''} onClose={() => setFileToDelete(null)} onConfirm={handleConfirmDelete} />
      <CloneModal isOpen={isCloneModalOpen} onClose={() => setIsCloneModalOpen(false)} onClone={handleClone} isCloning={git.isCloning} />
      <CommandPalette 
          isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} files={fs.files}
          onSelectFile={(id) => fs.selectFile(fs.files.find(f => f.id === id)!)}
          actions={[
              { id: 'new_file', label: 'New File', icon: <IconFilePlus size={16} />, run: () => fs.createNode('file', null, `file_${Date.now()}.ts`) },
              { id: 'toggle_term', label: 'Toggle Terminal', icon: <IconTerminal size={16} />, run: () => setIsTerminalOpen(!isTerminalOpen) },
              { id: 'settings', label: 'Settings', icon: <IconSettings size={16} />, run: () => setIsSettingsOpen(true) },
              { id: 'git', label: 'Git Status', icon: <IconGitBranch size={16} />, run: () => { setActiveSidebarView('git'); git.refresh(); } },
          ]}
      />
    </div>
  );
}

export default App;