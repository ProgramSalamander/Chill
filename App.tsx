

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  IconTerminal, IconFilePlus, IconFolderOpen, IconSparkles, 
  IconGitBranch, IconSettings
} from './components/Icons';
import CodeEditor from './components/CodeEditor';
import AIPanel from './components/AIPanel';
import Terminal from './components/Terminal';
import SettingsModal from './components/SettingsModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import CommandPalette from './components/CommandPalette';
import Sidebar from './components/Sidebar';
import EditorTabs from './components/EditorTabs';
import CloneModal from './components/CloneModal';
import MenuBar from './components/MenuBar';
import ContextBar from './components/ContextBar';

import { getCodeCompletion, editCode } from './services/geminiService';
import { initRuff, runPythonLint } from './services/lintingService';
import { projectService } from './services/projectService';
import { ragService } from './services/ragService';
import { File, TerminalLine, Diagnostic, ProjectMeta, SidebarView } from './types';
import { getFilePath, resolveFileByPath, extractSymbols } from './utils/fileUtils';
import { generatePreviewHtml } from './utils/previewUtils';
import { useFileSystem } from './hooks/useFileSystem';
import { useGit } from './hooks/useGit';
import { useAIChat } from './hooks/useAIChat';
import { SIDEBAR_VIEWS } from './views/sidebarViews';

type Theme = 'light' | 'dark';

function App() {
  // --- UI State ---
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('vibe_theme') as Theme) || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('vibe_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };
  
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

  // --- Sidebar Customization State ---
  const [sidebarViews, setSidebarViews] = useState<SidebarView[]>(() => {
    try {
      const saved = localStorage.getItem('vibe_sidebar_config');
      if (saved) {
        const parsed: SidebarView[] = JSON.parse(saved);
        const defaultViewsMap = new Map(SIDEBAR_VIEWS.map(v => [v.id, v]));

        // Reconstruct views using default data and saved properties
        const merged = parsed.map(savedView => {
            const defaultView = defaultViewsMap.get(savedView.id);
            if (defaultView) {
                return {
                    ...defaultView, // Use default view which has the icon
                    order: savedView.order,
                    visible: savedView.visible,
                };
            }
            return null; // This view was saved but no longer exists
        }).filter(Boolean) as SidebarView[];

        // Add any brand new views that weren't in the saved config
        const mergedIds = new Set(merged.map(v => v.id));
        const newViews = SIDEBAR_VIEWS.filter(v => !mergedIds.has(v.id));
        
        const finalViews = [...merged, ...newViews.map(v => ({...v, order: merged.length + 1, visible: true}))];

        return finalViews;
      }
    } catch (e) { console.warn("Could not parse sidebar config", e); }
    return SIDEBAR_VIEWS.map((view, index) => ({
      ...view,
      order: index,
      visible: true,
    }));
  });

  useEffect(() => {
    localStorage.setItem('vibe_sidebar_config', JSON.stringify(sidebarViews));
  }, [sidebarViews]);

  // --- Core Hooks ---
  const fs = useFileSystem(addTerminalLine);
  const git = useGit(fs.files, addTerminalLine);
  
  // --- AI Chat Hook ---
  const { messages, isGenerating, sendMessage, initChat, setMessages } = useAIChat(fs.files, fs.activeFile, contextScope, addTerminalLine);

  // --- Project Management State ---
  const [activeProject, setActiveProject] = useState<ProjectMeta | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([]);
  const debounceSaveProjectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Editor State ---
  const [cursorPosition, setCursorPosition] = useState(0);
  const [fileToDelete, setFileToDelete] = useState<File | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  
  // --- Agent Awareness State ---
  // Tracks file IDs that the agent has semantically accessed or searched
  const [agentAwareness, setAgentAwareness] = useState<Set<string>>(new Set());
  
  // Refs & Timers
  const lintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSuggestionResolve = useRef<((value: string | null) => void) | null>(null);
  const debounceIndexRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorPosRef = useRef(0);
  const activeFileIdRef = useRef(fs.activeFileId);
  const filesRef = useRef(fs.files);

  // --- Effects ---
  useEffect(() => { filesRef.current = fs.files; }, [fs.files]);
  useEffect(() => { activeFileIdRef.current = fs.activeFileId; }, [fs.activeFileId]);
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
    }, 2000);
  }, [fs.files, addTerminalLine]);

  // Project Management Effects
  useEffect(() => {
    setRecentProjects(projectService.getRecents());
    const lastProjectId = projectService.getActiveProjectId();
    if (lastProjectId) {
      const meta = projectService.getRecents().find(p => p.id === lastProjectId);
      if (meta) {
        const savedFiles = projectService.loadProject(lastProjectId);
        if (savedFiles) {
           fs.setAllFiles(savedFiles);
           setActiveProject(meta);
           addTerminalLine(`Loaded project: ${meta.name}`, 'info');
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    if (debounceSaveProjectRef.current) clearTimeout(debounceSaveProjectRef.current);
    debounceSaveProjectRef.current = setTimeout(() => {
      projectService.saveProject(fs.files, activeProject);
      setRecentProjects(projectService.getRecents());
    }, 2000);
    return () => { if (debounceSaveProjectRef.current) clearTimeout(debounceSaveProjectRef.current); };
  }, [fs.files, activeProject]);

  // Init Services
  useEffect(() => {
    initRuff().then(() => console.log('Ruff Linter initialized'));
    initChat();
  }, [initChat]);
  
  // Debounced Linting Effect
  useEffect(() => {
    if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    if (!fs.activeFile) {
        if (diagnostics.length > 0) setDiagnostics([]);
        return;
    }
    lintTimerRef.current = setTimeout(() => {
      if (fs.activeFile?.language === 'python') {
        setDiagnostics(runPythonLint(fs.activeFile.content));
      } else if (diagnostics.length > 0) {
        setDiagnostics([]);
      }
    }, 750);
  }, [fs.activeFile?.content, fs.activeFile?.id, diagnostics.length]);

  // --- Handlers ---
  const handleNewProject = async () => {
      const name = window.prompt("Enter project name:", "Untitled Project");
      if (!name) return;
      if (activeProject) projectService.saveProject(fs.files, activeProject);
      const newMeta = projectService.createProject(name);
      setActiveProject(newMeta);
      setRecentProjects(projectService.getRecents());
      fs.resetProject();
      git.reset();
      setMessages([]);
      setTerminalLines([]);
      setAgentAwareness(new Set());
      addTerminalLine(`New project created: ${name}`, 'success');
  };

  const handleLoadProject = async (project: ProjectMeta) => {
    if (activeProject?.id === project.id) return;
    if (activeProject) projectService.saveProject(fs.files, activeProject);
    const files = projectService.loadProject(project.id);
    if (files) {
       fs.setAllFiles(files);
       setActiveProject(project);
       projectService.saveProject(files, project);
       setRecentProjects(projectService.getRecents());
       git.reset();
       setAgentAwareness(new Set());
       addTerminalLine(`Switched to project: ${project.name}`, 'info');
    } else { addTerminalLine(`Failed to load project: ${project.name}`, 'error'); }
  };

  const handleClone = async (url: string) => {
      setIsCloneModalOpen(false);
      let project = activeProject;
      if (!project) {
          const name = url.split('/').pop()?.replace('.git', '') || 'Cloned Repo';
          project = projectService.createProject(name);
          setActiveProject(project);
      }
      const newFiles = await git.clone(url);
      if (newFiles) {
          fs.setAllFiles(newFiles);
          setAgentAwareness(new Set());
      }
  };

  const handlePull = async () => {
    const newFiles = await git.pull();
    if (newFiles) {
        fs.setAllFiles(newFiles);
        setAgentAwareness(new Set());
    }
  };

  const handleSaveAll = async () => {
      const modified = fs.files.filter(f => f.isModified);
      for (const f of modified) await fs.saveFile(f);
      if (activeProject) projectService.saveProject(fs.files, activeProject);
      if (modified.length > 0) addTerminalLine(`Saved ${modified.length} files.`, 'success');
  };

  const handleFileClick = (file: File) => fs.selectFile(file);

  const handleConfirmDelete = async () => {
      if (!fileToDelete) return;
      await fs.deleteNode(fileToDelete);
      if (fileToDelete.type === 'file') await git.deleteFile(fileToDelete);
      setFileToDelete(null);
  };

  const handleAgentAction = useCallback(async (action: string, args: any): Promise<string> => {
      const currentFiles = filesRef.current;
      
      const updateAwareness = (fileId: string) => {
          setAgentAwareness(prev => {
              const next = new Set(prev);
              next.add(fileId);
              return next;
          });
      };

      switch (action) {
          case 'listFiles': return currentFiles.map(f => `${f.type === 'folder' ? '[DIR]' : '[FILE]'} ${getFilePath(f, currentFiles)}`).sort().join('\n');
          
          case 'readFile': {
             const file = resolveFileByPath(args.path, currentFiles);
             if (file) updateAwareness(file.id);
             return file ? (file.type === 'file' ? file.content : "Error: Is a folder") : `Error: File not found ${args.path}`;
          }
          
          case 'writeFile': {
             const { path, content } = args;
             const existing = resolveFileByPath(path, currentFiles);
             if (existing) {
                 fs.updateFileContent(content, true, existing.id);
                 updateAwareness(existing.id);
                 return `Updated: ${path}`;
             }
             const name = path.split('/').pop() || 'untitled';
             const newFile = await fs.createNode('file', null, name, content);
             if (newFile) updateAwareness(newFile.id);
             return `Created: ${path}`;
          }
          
          case 'runCommand':
              addTerminalLine(`Agent: ${args.command}`, 'command');
              return `Executed: ${args.command}`;
              
          case 'searchCode': {
             const results = ragService.search(args.query);
             const foundFiles = results.map(r => r.filePath).join(', ');
             // Update awareness for all found files
             const foundIds = results.map(r => r.fileId);
             setAgentAwareness(prev => {
                 const next = new Set(prev);
                 foundIds.forEach(id => next.add(id));
                 return next;
             });

             if (results.length === 0) return "No matches found.";
             
             return `Found matches in: ${foundFiles}\n\n` + 
                    results.map(r => `File: ${r.filePath}\nMatch Score: ${r.score.toFixed(2)}\nSnippet:\n${r.snippet}`).join('\n\n');
          }

          case 'getFileStructure': {
             const file = resolveFileByPath(args.path, currentFiles);
             if (!file) return `Error: File not found ${args.path}`;
             if (file) updateAwareness(file.id);
             if (file.type !== 'file') return "Error: Is a folder";
             return extractSymbols(file);
          }

          default: return `Unknown tool: ${action}`;
      }
  }, [fs, addTerminalLine]);

  const handleFetchSuggestion = useCallback(async (code: string, offset: number): Promise<string | null> => {
    // Cancel any pending suggestion request
    if (pendingSuggestionResolve.current) {
        pendingSuggestionResolve.current(null);
        pendingSuggestionResolve.current = null;
    }
    // Clear previous timer
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);

    return new Promise((resolve) => {
        pendingSuggestionResolve.current = resolve;
        
        suggestionDebounceRef.current = setTimeout(async () => {
            pendingSuggestionResolve.current = null; // Claim ownership of this execution

            const currentFile = activeFileIdRef.current ? filesRef.current.find(f => f.id === activeFileIdRef.current) : null;
            if (!currentFile || isGenerating || isIndexing) {
                resolve(null);
                return;
            }
            try {
                const sugg = await getCodeCompletion(code, offset, currentFile.language, currentFile, filesRef.current);
                resolve(sugg || null);
            } catch (e) {
                console.error("Suggestion fetch failed:", e);
                resolve(null);
            }
        }, 400); // Slightly increased debounce to reduce spam
    });
  }, [isGenerating, isIndexing]);

  const handleInlineAssist = async (instruction: string, range: any) => {
      if (!fs.activeFile) return;
      const file = fs.activeFile;
      try {
          const lines = file.content.split('\n');
          const startLine = range.startLineNumber - 1, endLine = range.endLineNumber - 1;
          const startCol = range.startColumn - 1, endCol = range.endColumn - 1;
          let prefix = lines.slice(0, startLine).join('\n') + (startLine > 0 ? '\n' : '') + lines[startLine].substring(0, startCol);
          let suffix = lines[endLine].substring(endCol) + (endLine < lines.length -1 ? '\n' : '') + lines.slice(endLine + 1).join('\n');
          let selectedText = file.content.substring(file.content.indexOf(prefix) + prefix.length, file.content.lastIndexOf(suffix));
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
             console.log = (...args) => { addTerminalLine(args.map(a => JSON.stringify(a)).join(' ')); };
             eval(fs.activeFile.content);
             console.log = originalLog;
          } catch(e:any) { addTerminalLine(`Error: ${e.message}`, 'error'); }
      } else if (fs.activeFile.language === 'html') {
          setIsPreviewOpen(true);
      } else { addTerminalLine('Execution not supported in browser.', 'warning'); }
  };

  const activeFile = fs.activeFile;
  const getPreviewContent = useMemo(() => isPreviewOpen ? generatePreviewHtml(fs.files, activeFile) : '', [fs.files, activeFile, isPreviewOpen]);

  return (
    <div className="flex flex-col h-screen w-screen text-slate-300 font-sans overflow-hidden bg-transparent">
      <MenuBar 
        onNewProject={handleNewProject} onSaveAll={handleSaveAll}
        projectName={activeProject?.name || (fs.files.length > 0 ? "Draft Workspace" : undefined)}
        onOpenSettings={() => setIsSettingsOpen(true)} onOpenCloneModal={() => setIsCloneModalOpen(true)}
        recentProjects={recentProjects} onLoadProject={handleLoadProject}
        theme={theme} onToggleTheme={toggleTheme}
      />
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        <Sidebar
          // View Management
          allViews={sidebarViews}
          onUpdateViews={setSidebarViews}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          // File Explorer Data
          files={fs.files}
          activeFileId={fs.activeFileId}
          onFileClick={handleFileClick}
          onDelete={setFileToDelete}
          onRename={fs.renameNode}
          onCreate={fs.createNode}
          onToggleFolder={fs.toggleFolder}
          // Git Data
          isGitInitialized={git.isInitialized}
          gitStatus={git.status}
          gitCommits={git.commits}
          onStage={git.stage}
          onUnstage={git.unstage}
          onCommit={git.commit}
          onInitializeGit={() => git.init(fs.files)}
          onClone={handleClone}
          isCloning={git.isCloning}
          onPull={handlePull}
          onFetch={git.fetch}
          isPulling={git.isPulling}
          isFetching={git.isFetching}
          // Agent Awareness
          agentAwareness={agentAwareness}
        />
        <div className="flex-1 flex flex-col min-w-0 relative gap-3">
           <div className="shrink-0">
               <EditorTabs 
                  openFileIds={fs.openFileIds} activeFileId={fs.activeFileId} files={fs.files} setActiveFileId={fs.setActiveFileId}
                  onCloseTab={(e, id) => { e.stopPropagation(); fs.closeFile(id); }}
                  onClearSelection={() => setSelectedCode('')}
                  isPreviewOpen={isPreviewOpen} setIsPreviewOpen={setIsPreviewOpen} isAIOpen={isAIOpen} setIsAIOpen={setIsAIOpen} onRunCode={handleRunCode}
               />
           </div>
           <div className="flex-1 relative overflow-hidden rounded-2xl glass-panel shadow-2xl flex flex-col">
               {activeFile ? (
                   <div className="flex-1 relative overflow-hidden">
                       <CodeEditor 
                           key={activeFile.id}
                           theme={theme}
                           code={activeFile.content} language={activeFile.language}
                           onChange={(c) => fs.updateFileContent(c)}
                           onCursorChange={(p) => { setCursorPosition(p); lastCursorPosRef.current = p; }}
                           onSelectionChange={setSelectedCode}
                           onFetchSuggestion={handleFetchSuggestion}
                           onUndo={fs.undo} onRedo={fs.redo} showPreview={isPreviewOpen} previewContent={getPreviewContent} diagnostics={diagnostics}
                           onInlineAssist={handleInlineAssist}
                       />
                       {selectedCode && (
                          <div className="absolute bottom-8 right-8 z-40 animate-in slide-in-from-bottom-4 duration-300">
                              <ContextBar language={activeFile.language} onAction={(act) => { setIsAIOpen(true); sendMessage(`${act} the selected code:\n\`\`\`\n${selectedCode}\n\`\`\``); }} />
                          </div>
                       )}
                   </div>
               ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4 bg-gradient-to-b from-transparent to-black/20">
                       <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 animate-float shadow-xl backdrop-blur-sm">
                          <IconSparkles size={40} className="text-vibe-glow opacity-60" />
                       </div>
                       <p className="text-sm font-medium tracking-wide">Select a file to start vibing</p>
                       <p className="text-xs opacity-50">Cmd+P to search files</p>
                   </div>
               )}
               <AIPanel 
                  isOpen={isAIOpen} messages={messages} onSendMessage={sendMessage} isGenerating={isGenerating}
                  activeFile={activeFile} onClose={() => setIsAIOpen(false)}
                  onClearChat={() => setMessages([])}
                  onApplyCode={(c) => fs.updateFileContent(c, true)}
                  onInsertCode={(c) => fs.updateFileContent(activeFile!.content.slice(0, cursorPosition) + c + activeFile!.content.slice(cursorPosition), true)}
                  contextScope={contextScope} setContextScope={setContextScope} files={fs.files} onAgentAction={handleAgentAction}
               />
           </div>
           <div className={`transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] glass-panel rounded-2xl overflow-hidden ${isTerminalOpen ? 'h-48 shadow-xl' : 'h-10 opacity-80 hover:opacity-100'}`}>
              <Terminal lines={terminalLines} isOpen={isTerminalOpen} diagnostics={diagnostics} onToggle={() => setIsTerminalOpen(!isTerminalOpen)} />
           </div>
        </div>
      </div>
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
              { id: 'git', label: 'Git Status', icon: <IconGitBranch size={16} />, run: () => { 
                const sidebar = document.getElementById('sidebar-git-button');
                sidebar?.click();
                git.refresh(); 
              } },
          ]}
      />
    </div>
  );
}

export default App;
