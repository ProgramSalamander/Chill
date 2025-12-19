
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CodeEditor from './components/CodeEditor';
import AIPanel from './components/AIPanel';
import Terminal from './components/Terminal';
import SettingsModal from './components/SettingsModal';
import NewProjectModal from './components/NewProjectModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import DeleteProjectConfirmModal from './components/DeleteProjectConfirmModal';
import CommandPalette from './components/CommandPalette';
import Sidebar from './components/Sidebar';
import EditorTabs from './components/EditorTabs';
import CloneModal from './components/CloneModal';
import GitAuthModal from './components/GitAuthModal';
import MenuBar from './components/MenuBar'; 
import Toaster from './components/Toaster';
import StatusBar from './components/StatusBar';
import ErrorBoundary from './components/ErrorBoundary';
import ContextBar from './components/ContextBar';
import LandingView from './components/LandingView';
import { ContextMenu } from './components/ContextMenu';

import { useUIStore } from './stores/uiStore';
import { useFileTreeStore } from './stores/fileStore';
import { useProjectStore } from './stores/projectStore';
import { useTerminalStore } from './stores/terminalStore';
import { useChatStore } from './stores/chatStore';
import { useAgentStore } from './stores/agentStore';

import { aiService, runLinting, executionService, previewService } from './services';
import { generatePreviewHtml } from './utils/previewUtils';
import { getFilePath } from './utils/fileUtils';
import { IconSparkles, IconCommand, IconLayout, IconSettings, IconZap, IconBrain, IconRefresh, IconExternalLink, IconGlobe, IconClose } from './components/Icons';

function App() {
  const theme = useUIStore(state => state.theme);
  const activeSidebarView = useUIStore(state => state.activeSidebarView);
  
  const files = useFileTreeStore(state => state.files);
  const activeFileId = useFileTreeStore(state => state.activeFileId);
  const activeFile = useMemo(() => files.find(f => f.id === activeFileId) || null, [files, activeFileId]);
  
  const updateFileContent = useFileTreeStore(state => state.updateFileContent); 
  const undo = useFileTreeStore(state => state.undo);
  const redo = useFileTreeStore(state => state.redo);
  const saveFile = useFileTreeStore(state => state.saveFile);
  const loadInitialProject = useProjectStore(state => state.loadInitialProject);
  const activeProject = useProjectStore(state => state.activeProject);

  const setDiagnostics = useTerminalStore(state => state.setDiagnostics);
  const diagnostics = useTerminalStore(state => state.diagnostics);
  
  const isAIOpen = useUIStore(state => state.isAIOpen);
  const setIsAIOpen = useUIStore(state => state.setIsAIOpen);
  const isPreviewOpen = useUIStore(state => state.isPreviewOpen);
  const setIsPreviewOpen = useUIStore(state => state.setIsPreviewOpen);
  const showContextMenu = useUIStore(state => state.showContextMenu);
  const setIsCommandPaletteOpen = useUIStore(state => state.setIsCommandPaletteOpen);
  const setIsSettingsOpen = useUIStore(state => state.setIsSettingsOpen);
  const setIsTerminalOpen = useUIStore(state => state.setIsTerminalOpen);
  const setActiveSidebarView = useUIStore(state => state.setActiveSidebarView);

  const initChat = useChatStore(state => state.initChat);
  const sendMessage = useChatStore(state => state.sendMessage);
  const addPatch = useAgentStore(state => state.addPatch);

  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const lintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addTerminalLine = useTerminalStore(state => state.addTerminalLine);

  // --- Preview Logic ---
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefreshPreview = useCallback(() => {
      setPreviewKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!isPreviewOpen) return;

    const updatePreview = () => {
        // ALWAYS use generatePreviewHtml for the preview to ensure it is self-contained.
        // This allows us to remove 'allow-same-origin' from the iframe sandbox safely.
        const html = generatePreviewHtml(files, activeFile);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        setPreviewUrl(prev => {
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
            return url;
        });
    };

    // Debounce updates during typing
    const timer = setTimeout(updatePreview, 500);
    return () => clearTimeout(timer);
  }, [files, activeFile, isPreviewOpen]);

  // Cleanup Blob URLs
  useEffect(() => {
      return () => {
          if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      };
  }, [previewUrl]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const startApp = async () => {
      initChat();
      await loadInitialProject();
    };
    startApp();
  }, [initChat, loadInitialProject]);
  
  useEffect(() => {
    if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    if (!activeFile) {
        if (diagnostics.length > 0) setDiagnostics([]);
        return;
    }
    lintTimerRef.current = setTimeout(async () => {
      const newDiagnostics = await runLinting(activeFile.content, activeFile.language);
      if (JSON.stringify(newDiagnostics) !== JSON.stringify(diagnostics)) {
        setDiagnostics(newDiagnostics);
      }
    }, 750);
  }, [activeFile?.content, activeFile?.id, activeFile?.language, diagnostics, setDiagnostics]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmd && e.key === 'b') {
        e.preventDefault();
        const current = useUIStore.getState().activeSidebarView;
        setActiveSidebarView(current ? null : 'explorer');
      }
      if (cmd && e.key === 'l') {
        e.preventDefault();
        setIsAIOpen(!useUIStore.getState().isAIOpen);
      }
      if (cmd && e.key === 'j') {
        e.preventDefault();
        setIsTerminalOpen(!useUIStore.getState().isTerminalOpen);
      }
      if (cmd && e.key === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      if (cmd && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
      if (cmd && e.key === 's') {
        e.preventDefault();
        if (activeFile) saveFile(activeFile);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, saveFile, setActiveSidebarView, setIsAIOpen, setIsTerminalOpen, setIsCommandPaletteOpen, setIsSettingsOpen]);

  const handleGlobalContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { id: 'cmd', label: 'Spotlight', icon: <IconCommand size={14}/>, shortcut: '⌘P', onClick: () => setIsCommandPaletteOpen(true) },
      { id: 'ai-help', label: 'Ask AI Assistant', icon: <IconBrain size={14}/>, shortcut: '⌘L', onClick: () => setIsAIOpen(true) },
      { id: 'sep1', label: '', variant: 'separator', onClick: () => {} },
      { id: 'format', label: 'Format Document', icon: <IconZap size={14}/>, shortcut: '⇧⌥F', onClick: () => addTerminalLine("Formatting not implemented", "info") },
      { id: 'sidebar', label: 'Toggle Sidebar', icon: <IconLayout size={14}/>, shortcut: '⌘B', onClick: () => setActiveSidebarView(useUIStore.getState().activeSidebarView ? null : 'explorer') },
      { id: 'sep2', label: '', variant: 'separator', onClick: () => {} },
      { id: 'settings', label: 'Settings', icon: <IconSettings size={14}/>, shortcut: '⌘,', onClick: () => setIsSettingsOpen(true) },
    ]);
  }, [showContextMenu, setIsCommandPaletteOpen, setIsAIOpen, setIsSettingsOpen, setActiveSidebarView, addTerminalLine]);

  const handleSaveFile = useCallback(() => {
    if (activeFile) {
      saveFile(activeFile);
    }
  }, [activeFile, saveFile]);
  
  const handleFetchSuggestion = useCallback(async (code: string, offset: number, signal?: AbortSignal): Promise<string | null> => {
    const currentFile = useFileTreeStore.getState().files.find(f => f.id === useFileTreeStore.getState().activeFileId);
    if (!currentFile || useChatStore.getState().isGenerating || useUIStore.getState().indexingStatus === 'indexing') {
        return null;
    }

    try {
        const sugg = await aiService.getCodeCompletion(code, offset, currentFile.language, currentFile, useFileTreeStore.getState().files, signal);
        return sugg || null;
    } catch (e) {
        return null;
    }
  }, []);

  const handleInlineAssist = async (instruction: string, range: any) => {
      const file = useFileTreeStore.getState().files.find(f => f.id === useFileTreeStore.getState().activeFileId);
      if (!file) return;
      try {
          const lines = file.content.split('\n');
          const startLine = range.startLineNumber - 1, endLine = range.endLineNumber - 1;
          const startCol = range.startColumn - 1, endCol = range.endColumn - 1;
          let prefix = lines.slice(0, startLine).join('\n') + (startLine > 0 ? '\n' : '') + lines[startLine].substring(0, startCol);
          let suffix = lines[endLine].substring(endCol) + (endLine < lines.length -1 ? '\n' : '') + lines.slice(endLine + 1).join('\n');
          let selectedText = file.content.substring(file.content.indexOf(prefix) + prefix.length, file.content.lastIndexOf(suffix));
          
          const newCode = await aiService.editCode(prefix, selectedText, suffix, instruction, file, useFileTreeStore.getState().files);
          if (newCode) {
              const proposedContent = prefix + newCode + suffix;
              
              addPatch({
                fileId: file.id,
                range: {
                  startLineNumber: range.startLineNumber,
                  startColumn: 1, 
                  endLineNumber: range.endLineNumber,
                  endColumn: lines[endLine].length + 1
                },
                originalText: file.content,
                proposedText: proposedContent
              });

              addTerminalLine('AI Proposal Staged Inline', 'success');
          }
      } catch (e) {
          console.error(e);
          addTerminalLine('Inline Edit Failed', 'error');
      }
  };

  const handleAICommand = (type: 'test' | 'docs' | 'refactor' | 'fix', context: any) => {
    const file = useFileTreeStore.getState().files.find(f => f.id === useFileTreeStore.getState().activeFileId);
    if (!file) return;

    if (type === 'fix') {
      const { error, range } = context;
      addTerminalLine(`Auto-fixing: ${error}...`, 'info');
      const instruction = `Fix this error: "${error}". Return the corrected code block.`;
      handleInlineAssist(instruction, range);
    } else if (type === 'test') {
      setIsAIOpen(true);
      sendMessage(`Generate comprehensive unit tests for the following code:\n\`\`\`${file.language}\n${context.code}\n\`\`\``);
    } else if (type === 'docs') {
      const instruction = "Add detailed documentation (JSDoc/Docstring) to this code.";
      handleInlineAssist(instruction, context.range);
    } else if (type === 'refactor') {
      const instruction = "Refactor this code to be cleaner, more efficient, and robust. Maintain functionality.";
      handleInlineAssist(instruction, context.range);
    }
  };

  const handleRunCode = async () => {
      if (!activeFile) return;
      const { setIsPreviewOpen } = useUIStore.getState();
      
      if (activeFile.language === 'html' || activeFile.language === 'markdown') {
          setIsPreviewOpen(true);
          setTimeout(() => handleRefreshPreview(), 100);
      } else {
          await executionService.runCode(activeFile.content, activeFile.language);
      }
  };

  const activeFilePath = activeFile ? getFilePath(activeFile, files) : undefined;

  return (
    <div 
      className="flex flex-col h-screen w-screen text-slate-300 font-sans overflow-hidden bg-transparent"
      onContextMenu={handleGlobalContextMenu}
    >
      <MenuBar />
      
      {!activeProject ? (
        <LandingView />
      ) : (
        <div className="flex-1 flex overflow-hidden p-3 gap-3 animate-in fade-in zoom-in-95 duration-500">
          <ErrorBoundary>
            <Sidebar />
          </ErrorBoundary>
          <div className="flex-1 flex flex-col min-w-0 relative gap-3">
              <ErrorBoundary>
                <div className="shrink-0">
                    <EditorTabs 
                      onClearSelection={() => setSelectedCode('')}
                      onRunCode={handleRunCode}
                      hasActiveFile={!!activeFile}
                    />
                </div>
              </ErrorBoundary>
              
              <div className="flex-1 relative overflow-hidden rounded-2xl glass-panel shadow-2xl flex flex-row">
                  <ErrorBoundary>
                    {activeFile ? (
                        <>
                            <div className={`relative h-full transition-[width] duration-300 ease-out ${isPreviewOpen ? 'w-1/2 border-r border-vibe-border' : 'w-full'}`}>
                                <CodeEditor 
                                    theme={theme}
                                    code={activeFile.content} 
                                    language={activeFile.language}
                                    path={activeFilePath}
                                    onChange={(c) => updateFileContent(c)}
                                    onCursorChange={setCursorPosition}
                                    onSelectionChange={setSelectedCode}
                                    onFetchSuggestion={handleFetchSuggestion}
                                    onUndo={undo} onRedo={redo}
                                    onSave={handleSaveFile}
                                    diagnostics={diagnostics}
                                    onInlineAssist={handleInlineAssist}
                                    onAICommand={handleAICommand}
                                />
                                {selectedCode && (
                                  <div className="absolute bottom-8 right-8 z-40 animate-in slide-in-from-bottom-4 duration-300">
                                      <ContextBar language={activeFile.language} onAction={(act) => { setIsAIOpen(true); sendMessage(`${act} the selected code:\n\`\`\`\n${selectedCode}\n\`\`\``); }} />
                                  </div>
                                )}
                            </div>
                            
                            {isPreviewOpen && (
                                <div className="w-1/2 h-full bg-white animate-in slide-in-from-right-5 fade-in duration-300 border-l border-vibe-border overflow-hidden relative flex flex-col">
                                    {/* Browser Toolbar */}
                                    <div className="h-9 shrink-0 bg-slate-100 border-b border-slate-200 flex items-center px-2 gap-2 text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-50"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 opacity-50"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-400 opacity-50"></div>
                                        </div>
                                        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-md px-2 py-0.5 mx-2 text-[10px] shadow-sm group hover:border-slate-300 transition-colors">
                                            <IconGlobe size={12} className="text-slate-400 mr-2 group-hover:text-blue-500" />
                                            <span className="truncate text-slate-500 font-mono select-none flex-1">
                                              {previewUrl.startsWith('blob:') ? 'Self-Contained Preview' : 'Preview Runtime'}
                                            </span>
                                            <button 
                                                onClick={handleRefreshPreview} 
                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                                title="Reload Frame"
                                            >
                                                <IconRefresh size={12} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => setIsPreviewOpen(false)}
                                                className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 hover:text-red-500 transition-colors"
                                                title="Close Preview"
                                            >
                                                <IconClose size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Content Frame - Removed 'allow-same-origin' to satisfy security policies and prevent escape */}
                                    <iframe 
                                        key={previewKey}
                                        ref={iframeRef}
                                        className="w-full h-full border-none bg-white"
                                        src={previewUrl}
                                        title="Live Preview"
                                        sandbox="allow-scripts allow-modals allow-forms" 
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full flex flex-col items-center justify-center h-full text-slate-600 space-y-4 bg-gradient-to-b from-transparent to-black/20">
                            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 animate-float shadow-xl backdrop-blur-sm">
                              <IconSparkles size={40} className="text-vibe-glow opacity-60" />
                            </div>
                            <p className="text-sm font-medium tracking-wide">Select a file to start vibing</p>
                            <p className="text-xs opacity-50">Cmd+P to search files</p>
                        </div>
                    )}
                  </ErrorBoundary>
              </div>

              <ErrorBoundary>
                <div className="transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]">
                  <Terminal />
                </div>
              </ErrorBoundary>
          </div>
          <ErrorBoundary>
            <AIPanel 
              onInsertCode={(c) => activeFile && updateFileContent(activeFile.content.slice(0, cursorPosition) + c + activeFile.content.slice(cursorPosition), true)}
            />
          </ErrorBoundary>
        </div>
      )}

      <StatusBar />
      <Toaster />
      <SettingsModal />
      <NewProjectModal />
      <DeleteConfirmModal />
      <DeleteProjectConfirmModal />
      <CloneModal />
      <GitAuthModal />
      <CommandPalette />
      <ContextMenu />
    </div>
  );
}

export default App;
