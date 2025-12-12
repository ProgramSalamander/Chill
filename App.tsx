import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CodeEditor from './components/CodeEditor';
import AIPanel from './components/AIPanel';
import Terminal from './components/Terminal';
import SettingsModal from './components/SettingsModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import DeleteProjectConfirmModal from './components/DeleteProjectConfirmModal';
import CommandPalette from './components/CommandPalette';
import Sidebar from './components/Sidebar';
import EditorTabs from './components/EditorTabs';
import CloneModal from './components/CloneModal';
import MenuBar from './components/MenuBar'; 
import Toaster from './components/Toaster';
import StatusBar from './components/StatusBar';
import ErrorBoundary from './components/ErrorBoundary';
import ContextBar from './components/ContextBar';

import { useUIStore } from './stores/uiStore';
import { useFileTreeStore } from './stores/fileStore';
import { useProjectStore } from './stores/projectStore';
import { useTerminalStore } from './stores/terminalStore';
import { useChatStore } from './stores/chatStore';

import { aiService } from './services/aiService';
import { initRuff, runPythonLint } from './services/lintingService';
import { ragService } from './services/ragService';
import { generatePreviewHtml } from './utils/previewUtils';
import { IconSparkles } from './components/Icons';

function App() {
  // --- STATE FROM ZUSTAND STORES ---
  const theme = useUIStore(state => state.theme);
  
  const files = useFileTreeStore(state => state.files);
  const activeFile = useFileTreeStore(state => state.activeFile);
  const updateFileContent = useFileTreeStore(state => state.updateFileContent); 
  const undo = useFileTreeStore(state => state.undo);
  const redo = useFileTreeStore(state => state.redo);
  const saveFile = useFileTreeStore(state => state.saveFile);
  const loadInitialProject = useProjectStore(state => state.loadInitialProject);

  const setDiagnostics = useTerminalStore(state => state.setDiagnostics);
  const diagnostics = useTerminalStore(state => state.diagnostics);
  
  const isAIOpen = useUIStore(state => state.isAIOpen);
  const setIsAIOpen = useUIStore(state => state.setIsAIOpen);
  const isPreviewOpen = useUIStore(state => state.isPreviewOpen);

  const initChat = useChatStore(state => state.initChat);
  const sendMessage = useChatStore(state => state.sendMessage);

  // --- LOCAL COMPONENT STATE & REFS ---
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const lintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSuggestionResolve = useRef<((value: string | null) => void) | null>(null);
  const addTerminalLine = useTerminalStore(state => state.addTerminalLine);

  // --- EFFECTS ---

  // Apply theme to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Initialize services and load project on startup
  useEffect(() => {
    initRuff().then(() => console.log('Ruff Linter initialized'));
    initChat();
    loadInitialProject();
  }, [initChat, loadInitialProject]);
  
  // Debounced Linting Effect
  useEffect(() => {
    if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    if (!activeFile) {
        if (diagnostics.length > 0) setDiagnostics([]);
        return;
    }
    lintTimerRef.current = setTimeout(() => {
      if (activeFile?.language === 'python') {
        setDiagnostics(runPythonLint(activeFile.content));
      } else if (diagnostics.length > 0) {
        setDiagnostics([]);
      }
    }, 750);
  }, [activeFile?.content, activeFile?.id, diagnostics, setDiagnostics]);

  // --- HANDLERS ---
  const handleSaveFile = useCallback(() => {
    if (activeFile) {
      saveFile(activeFile);
    }
  }, [activeFile, saveFile]);
  
  const handleFetchSuggestion = useCallback(async (code: string, offset: number): Promise<string | null> => {
    if (pendingSuggestionResolve.current) {
        pendingSuggestionResolve.current(null);
        pendingSuggestionResolve.current = null;
    }
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);

    return new Promise((resolve) => {
        pendingSuggestionResolve.current = resolve;
        
        suggestionDebounceRef.current = setTimeout(async () => {
            pendingSuggestionResolve.current = null; 

            const currentFile = useFileTreeStore.getState().activeFile;
            if (!currentFile || useChatStore.getState().isGenerating || useUIStore.getState().indexingStatus === 'indexing') {
                resolve(null);
                return;
            }
            try {
                const sugg = await aiService.getCodeCompletion(code, offset, currentFile.language, currentFile, useFileTreeStore.getState().files);
                resolve(sugg || null);
            } catch (e) {
                console.error("Suggestion fetch failed:", e);
                resolve(null);
            }
        }, 400);
    });
  }, []);

  const handleInlineAssist = async (instruction: string, range: any) => {
      const file = useFileTreeStore.getState().activeFile;
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
              const updatedContent = prefix + newCode + suffix;
              updateFileContent(updatedContent);
              addTerminalLine('Inline Edit Applied', 'success');
          }
      } catch (e) {
          console.error(e);
          addTerminalLine('Inline Edit Failed', 'error');
      }
  };

  const handleAICommand = (type: 'test' | 'docs' | 'refactor' | 'fix', context: any) => {
    const file = useFileTreeStore.getState().activeFile;
    if (!file) return;

    if (type === 'fix') {
      const { error, range } = context;
      addTerminalLine(`Auto-fixing: ${error}...`, 'info');
      // Use inline assist to fix directly
      const instruction = `Fix this error: "${error}". Return the corrected code block.`;
      
      // Calculate a range slightly around the error for context if needed, 
      // but Monaco context object passed here usually has the error range.
      // We pass the error range directly to inline assist.
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

  const handleRunCode = () => {
      if (!activeFile) return;
      const { setIsPreviewOpen } = useUIStore.getState();
      addTerminalLine(`Running ${activeFile.name}...`, 'command');
      if (['javascript','typescript'].includes(activeFile.language)) {
          try {
             const originalLog = console.log;
             console.log = (...args) => { addTerminalLine(args.map(a => JSON.stringify(a)).join(' ')); };
             eval(activeFile.content);
             console.log = originalLog;
          } catch(e:any) { addTerminalLine(`Error: ${e.message}`, 'error'); }
      } else if (activeFile.language === 'html') {
          setIsPreviewOpen(true);
      } else { addTerminalLine('Execution not supported in browser.', 'warning'); }
  };

  const getPreviewContent = useMemo(() => isPreviewOpen ? generatePreviewHtml(files, activeFile) : '', [files, activeFile, isPreviewOpen]);

  return (
    <div className="flex flex-col h-screen w-screen text-slate-300 font-sans overflow-hidden bg-transparent">
      <MenuBar />
       <div className="flex-1 flex overflow-hidden p-3 gap-3">
         <ErrorBoundary>
           <Sidebar />
         </ErrorBoundary>
         <div className="flex-1 flex flex-col min-w-0 relative gap-3">
            <ErrorBoundary>
              <div className="shrink-0">
                  <EditorTabs 
                     onClearSelection={() => setSelectedCode('')}
                     onRunCode={handleRunCode}
                  />
              </div>
            </ErrorBoundary>
            <div className="flex-1 relative overflow-hidden rounded-2xl glass-panel shadow-2xl flex flex-col">
                <ErrorBoundary>
                  {activeFile ? (
                      <div className="flex-1 relative overflow-hidden">
                          <CodeEditor 
                              key={activeFile.id}
                              theme={theme}
                              code={activeFile.content} language={activeFile.language}
                              onChange={(c) => updateFileContent(c)}
                              onCursorChange={setCursorPosition}
                              onSelectionChange={setSelectedCode}
                              onFetchSuggestion={handleFetchSuggestion}
                              onUndo={undo} onRedo={redo}
                              onSave={handleSaveFile}
                              showPreview={isPreviewOpen} previewContent={getPreviewContent} diagnostics={diagnostics}
                              onInlineAssist={handleInlineAssist}
                              onAICommand={handleAICommand}
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
                </ErrorBoundary>
            </div>
            <ErrorBoundary>
              <div className="transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]">
                 <Terminal />
              </div>
            </ErrorBoundary>
         </div>
         <ErrorBoundary>
           <AIPanel 
             onInsertCode={(c) => updateFileContent(activeFile!.content.slice(0, cursorPosition) + c + activeFile!.content.slice(cursorPosition), true)}
           />
         </ErrorBoundary>
      </div>
      <StatusBar />
      <Toaster />
      <SettingsModal />
      <DeleteConfirmModal />
      <DeleteProjectConfirmModal />
      <CloneModal />
      <CommandPalette />
    </div>
  );
}

export default App;