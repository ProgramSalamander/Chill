
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

import { createChatSession, sendMessageStream, getCodeCompletion } from './services/geminiService';
import { initRuff, runPythonLint } from './services/lintingService';
import { gitService } from './services/gitService';
import { File, Message, MessageRole, TerminalLine, Diagnostic, AISession } from './types';
import { getFilePath, resolveFileByPath, generateProjectContext } from './utils/fileUtils';
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
  
  // Refs & Timers
  const lintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleOpenProject = async () => {
      const loaded = await fs.handleOpenFolder();
      if (!loaded) return;
      
      // Git Detection
      if (fs.projectHandle) {
          try {
             // @ts-ignore
             await fs.projectHandle.getDirectoryHandle('.git');
             git.setIsInitialized(true);
             await gitService.init(); // Soft init to load git state
             // Sync loaded files to git in-memory
             for (const f of loaded) {
                if (f.type === 'file') {
                    const path = getFilePath(f, loaded);
                    await gitService.writeFile(path, f.content);
                }
             }
             git.refresh();
             addTerminalLine('Git repository detected.', 'info');
          } catch(e) {
             git.reset();
             addTerminalLine('No git repository detected.', 'info');
          }
      }
  };

  const handleNewProject = async () => {
      if (fs.files.length > 0 && !window.confirm("Start new project? Unsaved memory changes lost.")) return;
      fs.resetProject();
      git.reset();
      setMessages([]);
      setTerminalLines([]);
      addTerminalLine('New project created.', 'info');
  };

  const handleClone = async (url: string) => {
      setIsCloneModalOpen(false);
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
            if (!isGenerating && !suggestion) {
                try {
                    const ctx = generateProjectContext(fs.files);
                    const sugg = await getCodeCompletion(fs.activeFile.content, lastCursorPosRef.current, fs.activeFile.language, ctx);
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
  }, [fs.activeFile, fs.files, isGenerating, suggestion]);

  const handleSendMessage = async (text: string) => {
    if (!chatSessionRef.current) return;
    const userMsg: Message = { id: Date.now().toString(), role: MessageRole.USER, text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      let prompt = text;
      if (contextScope === 'project') {
          prompt = `[PROJECT CONTEXT]\n${generateProjectContext(fs.files)}\n\n[QUERY]\n${text}`;
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
    <div className="flex flex-col h-screen w-screen bg-[#050508] text-slate-300 font-sans overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-vibe-accent/30 to-transparent"></div>
      
      <MenuBar 
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveAll={handleSaveAll}
        projectName={fs.projectHandle?.name}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCloneModal={() => setIsCloneModalOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          activeView={activeSidebarView} 
          setActiveView={setActiveSidebarView} 
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          gitStatus={git.status}
        />

        {activeSidebarView && (
          <div className="w-64 bg-[#0a0a0f]/80 backdrop-blur-xl border-r border-white/5 flex flex-col animate-in slide-in-from-left-4 duration-300">
             {activeSidebarView === 'explorer' && (
               <div className="flex flex-col h-full">
                  <div className="p-3 text-xs font-bold text-slate-500 uppercase flex justify-between">
                    <span>Explorer</span>
                    <button onClick={() => fs.createNode('file', null, `untitled_${fs.files.length}.ts`)}><IconFilePlus size={14} /></button>
                  </div>
                  {fs.files.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 opacity-50 space-y-3">
                          <IconFolderOpen size={32} />
                          <p className="text-xs">No project</p>
                          <button onClick={handleOpenProject} className="text-vibe-accent text-xs hover:underline">Open Folder</button>
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

        <div className="flex-1 flex flex-col min-w-0 bg-[#050508] relative">
           <div className="px-2 pt-2 pb-0">
               <EditorTabs 
                  openFileIds={fs.openFileIds} activeFileId={fs.activeFileId} files={fs.files} setActiveFileId={fs.setActiveFileId}
                  onCloseTab={(e, id) => { e.stopPropagation(); fs.closeFile(id); }} onClearSelection={() => setSelectedCode('')}
                  isPreviewOpen={isPreviewOpen} setIsPreviewOpen={setIsPreviewOpen} isAIOpen={isAIOpen} setIsAIOpen={setIsAIOpen} onRunCode={handleRunCode}
               />
           </div>

           <div className="flex-1 relative overflow-hidden m-2 mt-0 rounded-2xl border border-white/5 shadow-2xl bg-[#0a0a0f]">
               {activeFile ? (
                   <>
                       <CodeEditor 
                           code={activeFile.content} language={activeFile.language}
                           onChange={(c) => fs.updateFileContent(c)}
                           cursorOffset={cursorPosition} onCursorChange={(p) => { setCursorPosition(p); lastCursorPosRef.current = p; }}
                           onSelectionChange={setSelectedCode} suggestion={suggestion}
                           onAcceptSuggestion={() => { if(suggestion) { fs.updateFileContent(activeFile.content.slice(0, cursorPosition) + suggestion + activeFile.content.slice(cursorPosition)); setSuggestion(null); } }}
                           onUndo={fs.undo} onRedo={fs.redo} showPreview={isPreviewOpen} previewContent={getPreviewContent} diagnostics={diagnostics}
                       />
                       {selectedCode && (
                          <div className="absolute bottom-6 right-8 z-50">
                              <ContextBar language={activeFile.language} onAction={(act) => { setIsAIOpen(true); handleSendMessage(`${act} the selected code:\n\`\`\`\n${selectedCode}\n\`\`\``); }} />
                          </div>
                       )}
                   </>
               ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                       <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 animate-float"><IconSparkles size={32} className="text-vibe-glow opacity-50" /></div>
                       <p className="text-sm font-medium">Select a file</p>
                   </div>
               )}
               <AIPanel 
                  isOpen={isAIOpen} messages={messages} onSendMessage={handleSendMessage} isGenerating={isGenerating}
                  activeFile={activeFile} onClose={() => setIsAIOpen(false)}
                  onApplyCode={(c) => fs.updateFileContent(c, true)}
                  onInsertCode={(c) => fs.updateFileContent(activeFile!.content.slice(0, cursorPosition) + c + activeFile!.content.slice(cursorPosition), true)}
                  contextScope={contextScope} setContextScope={setContextScope} files={fs.files} onAgentAction={handleAgentAction}
               />
           </div>

           <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-[#050508] ${isTerminalOpen ? 'h-48' : 'h-8'}`}>
              {isTerminalOpen ? (
                   <div className="h-full flex flex-col relative">
                       <button onClick={() => setIsTerminalOpen(false)} className="absolute top-2 right-4 text-slate-500 hover:text-white z-20"><IconClose size={14}/></button>
                       <Terminal lines={terminalLines} isOpen={true} diagnostics={diagnostics} />
                   </div>
              ) : (
                   <div className="h-full flex items-center px-4 bg-[#0a0a0f] cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsTerminalOpen(true)}>
                       <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><IconTerminal size={12} /><span>Terminal</span></div>
                       {diagnostics.length > 0 && <div className="ml-4 text-xs text-red-400">{diagnostics.length} Problems</div>}
                   </div>
              )}
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
              { id: 'git', label: 'Git Status', icon: <IconGitBranch size={16} />, run: () => { setActiveSidebarView('git'); git.refresh(); } },
          ]}
      />
    </div>
  );
}

export default App;
