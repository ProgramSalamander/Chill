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
import ContextBar from './components/ContextBar';

import { useUIStore } from './stores/uiStore';
import { useFileStore } from './stores/fileStore';
import { useTerminalStore } from './stores/terminalStore';
import { useChatStore } from './stores/chatStore';

import { getCodeCompletion, editCode } from './services/geminiService';
import { initRuff, runPythonLint } from './services/lintingService';
import { ragService } from './services/ragService';
import { generatePreviewHtml } from './utils/previewUtils';
import { IconSparkles } from './components/Icons';

function App() {
  // --- STATE FROM ZUSTAND STORES ---
  const theme = useUIStore(state => state.theme);
  
  const files = useFileStore(state => state.files);
  const activeFile = useFileStore(state => state.activeFile);
  const updateFileContent = useFileStore(state => state.updateFileContent);
  const undo = useFileStore(state => state.undo);
  const redo = useFileStore(state => state.redo);
  const loadInitialProject = useFileStore(state => state.loadInitialProject);

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
  const [isIndexing, setIsIndexing] = useState(false);
  const lintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSuggestionResolve = useRef<((value: string | null) => void) | null>(null);
  const debounceIndexRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  
  // RAG Indexing Effect
  useEffect(() => {
    if (debounceIndexRef.current) clearTimeout(debounceIndexRef.current);
    debounceIndexRef.current = setTimeout(() => {
      if (files.length > 0) {
        setIsIndexing(true);
        addTerminalLine('Building smart context index...', 'info');
        ragService.updateIndex(files).then(() => {
          setIsIndexing(false);
          addTerminalLine('Smart context ready.', 'success');
        });
      }
    }, 2000);
  }, [files, addTerminalLine]);

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

            const currentFile = useFileStore.getState().activeFile;
            if (!currentFile || useChatStore.getState().isGenerating || isIndexing) {
                resolve(null);
                return;
            }
            try {
                const sugg = await getCodeCompletion(code, offset, currentFile.language, currentFile, useFileStore.getState().files);
                resolve(sugg || null);
            } catch (e) {
                console.error("Suggestion fetch failed:", e);
                resolve(null);
            }
        }, 400);
    });
  }, [isIndexing]);

  const handleInlineAssist = async (instruction: string, range: any) => {
      const file = useFileStore.getState().activeFile;
      if (!file) return;
      try {
          const lines = file.content.split('\n');
          const startLine = range.startLineNumber - 1, endLine = range.endLineNumber - 1;
          const startCol = range.startColumn - 1, endCol = range.endColumn - 1;
          let prefix = lines.slice(0, startLine).join('\n') + (startLine > 0 ? '\n' : '') + lines[startLine].substring(0, startCol);
          let suffix = lines[endLine].substring(endCol) + (endLine < lines.length -1 ? '\n' : '') + lines.slice(endLine + 1).join('\n');
          let selectedText = file.content.substring(file.content.indexOf(prefix) + prefix.length, file.content.lastIndexOf(suffix));
          
          const newCode = await editCode(prefix, selectedText, suffix, instruction, file, useFileStore.getState().files);
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
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 relative gap-3">
           <div className="shrink-0">
               <EditorTabs 
                  onClearSelection={() => setSelectedCode('')}
                  onRunCode={handleRunCode}
               />
           </div>
           <div className="flex-1 relative overflow-hidden rounded-2xl glass-panel shadow-2xl flex flex-col">
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
                           onUndo={undo} onRedo={redo} showPreview={isPreviewOpen} previewContent={getPreviewContent} diagnostics={diagnostics}
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
           </div>
           <div className="transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]">
              <Terminal />
           </div>
        </div>
        <AIPanel 
          onInsertCode={(c) => updateFileContent(activeFile!.content.slice(0, cursorPosition) + c + activeFile!.content.slice(cursorPosition), true)}
        />
      </div>
      <SettingsModal />
      <DeleteConfirmModal />
      <DeleteProjectConfirmModal />
      <CloneModal />
      <CommandPalette />
    </div>
  );
}

export default App;