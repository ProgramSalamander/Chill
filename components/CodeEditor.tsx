import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Diagnostic } from '../types';
import { InlineInput } from './InlineInput';
import { ragService } from '../services/ragService';

interface CodeEditorProps {
  code: string;
  language: string;
  theme: 'light' | 'dark';
  onChange: (newCode: string) => void;
  className?: string;
  cursorOffset?: number;
  onCursorChange?: (position: number) => void;
  onSelectionChange?: (selection: string) => void;
  onFetchSuggestion: (code: string, offset: number) => Promise<string | null>;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  // Live Preview Props
  showPreview?: boolean;
  previewContent?: string;
  diagnostics?: Diagnostic[];
  // Inline AI
  onInlineAssist?: (instruction: string, range: any) => Promise<void>;
  onAICommand?: (type: 'test' | 'docs' | 'refactor' | 'fix', context: any) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  language, 
  theme,
  onChange, 
  className, 
  onCursorChange,
  onSelectionChange,
  onFetchSuggestion,
  onUndo,
  onRedo,
  onSave,
  showPreview = false,
  previewContent = '',
  diagnostics = [],
  onInlineAssist,
  onAICommand
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Disposables ref to clean up providers
  const disposablesRef = useRef<any[]>([]);
  
  // Inline Input State
  const [inlineInputPos, setInlineInputPos] = useState<{ top: number; left: number; lineHeight: number } | null>(null);
  const [isProcessingInline, setIsProcessingInline] = useState(false);
  const [savedSelection, setSavedSelection] = useState<any>(null);

  // Map app languages to Monaco languages
  const getMonacoLanguage = (lang: string) => {
    if (lang === 'js') return 'javascript';
    if (lang === 'ts') return 'typescript';
    if (lang === 'jsx') return 'javascript'; // Monaco handles JSX in JS
    if (lang === 'tsx') return 'typescript'; // Monaco handles TSX in TS
    return lang;
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme');
    }
  }, [theme]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Clear previous disposables
    disposablesRef.current.forEach(d => d.dispose());
    disposablesRef.current = [];

    // --- Vibe Dark Theme Definition ---
    monaco.editor.defineTheme('vibe-dark-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'class', foreground: '8be9fd' },
        { token: 'function', foreground: '50fa7b' },
        { token: 'variable', foreground: 'f8f8f2' },
        { token: 'delimiter', foreground: 'f8f8f2' },
      ],
      colors: {
        'editor.background': '#00000000', // Transparent for glass effect
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#ffffff08',
        'editor.selectionBackground': '#818cf840',
        'editorCursor.foreground': '#818cf8',
        'editorWhitespace.foreground': '#3b3a32',
        'editorIndentGuide.background': '#ffffff10',
        'editorIndentGuide.activeBackground': '#ffffff30',
        'editorLineNumber.foreground': '#6272a4',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'scrollbarSlider.background': '#ffffff10',
        'scrollbarSlider.hoverBackground': '#ffffff20',
        'scrollbarSlider.activeBackground': '#ffffff30',
        // Code Lens colors
        'editorCodeLens.foreground': '#6272a4'
      }
    });

    // --- Vibe Light Theme Definition ---
    monaco.editor.defineTheme('vibe-light-theme', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '8500b6', fontStyle: 'bold' },
          { token: 'string', foreground: '2d8f25' },
          { token: 'number', foreground: 'cd3838' },
          { token: 'type', foreground: '0075c3' },
          { token: 'function', foreground: '5f3ac1' },
          { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' },
        ],
        colors: {
            'editor.background': '#00000000',
            'editor.foreground': '#111827',
            'editor.lineHighlightBackground': '#00000008',
            'editor.selectionBackground': '#4f46e520',
            'editorCursor.foreground': '#4f46e5',
            'editorLineNumber.foreground': '#a1a1aa',
            'editorLineNumber.activeForeground': '#1f2937',
            'scrollbarSlider.background': '#00000010',
            'scrollbarSlider.hoverBackground': '#00000020',
            'scrollbarSlider.activeBackground': '#00000030',
        }
    });

    monaco.editor.setTheme(theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme');
    
    // --- 1. Inline Completions Provider (AI) ---
    const inlineProvider = monaco.languages.registerInlineCompletionsProvider(getMonacoLanguage(language), {
      provideInlineCompletions: async (model, position, context, token) => {
        const code = model.getValue();
        const offset = model.getOffsetAt(position);
        try {
          const suggestionText = await onFetchSuggestion(code, offset);
          if (suggestionText) {
            return {
              items: [{ insertText: suggestionText }]
            };
          }
        } catch (e) {
          console.error("Error fetching inline suggestion:", e);
        }
        return { items: [] };
      },
      disposeInlineCompletions: async (completions, reason) => {},
    });
    disposablesRef.current.push(inlineProvider);

    // --- 2. Semantic Autocomplete Provider (RAG) ---
    const completionProvider = monaco.languages.registerCompletionItemProvider(getMonacoLanguage(language), {
        triggerCharacters: ['.', ' ', '(', '{'],
        provideCompletionItems: async (model, position) => {
            const wordUntil = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: wordUntil.startColumn,
                endColumn: wordUntil.endColumn
            };

            const textUntil = model.getValueInRange({
                startLineNumber: position.lineNumber, 
                startColumn: 1, 
                endLineNumber: position.lineNumber, 
                endColumn: position.column
            });
            
            // Only search if we have enough context
            if (textUntil.trim().length < 4) return { suggestions: [] };

            const results = ragService.search(textUntil, 3);
            
            const suggestions = results.map(r => ({
                label: { 
                    label: `✨ ${r.snippet.slice(0, 30).replace(/\n/g, ' ')}...`, 
                    description: `from ${r.filePath}` 
                },
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: r.snippet,
                documentation: `Matched Code from ${r.filePath}:\n\n${r.snippet}`,
                range: range,
                sortText: '000_' + r.score // Prioritize these
            }));

            return { suggestions };
        }
    });
    disposablesRef.current.push(completionProvider);

    // --- 3. AI Code Lenses ---
    const commandId = editor.addCommand(0, (accessor: any, callback: any) => {
        if (callback) callback();
    }, '');

    const lensProvider = monaco.languages.registerCodeLensProvider(getMonacoLanguage(language), {
        provideCodeLenses: (model) => {
            const lenses = [];
            const content = model.getValue();
            
            // Regex to find functions and classes
            const regex = /(?:export\s+)?(?:async\s+)?(?:function\s+([a-zA-Z0-9_]+)|class\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)/g;
            
            let match;
            while ((match = regex.exec(content)) !== null) {
                const startPos = model.getPositionAt(match.index);
                const endPos = model.getPositionAt(match.index + match[0].length);
                const range = {
                    startLineNumber: startPos.lineNumber,
                    startColumn: startPos.column,
                    endLineNumber: endPos.lineNumber,
                    endColumn: endPos.column
                };

                // Generate Test
                lenses.push({
                    range,
                    id: "test",
                    command: {
                        id: commandId!,
                        title: "$(beaker) Generate Test",
                        arguments: [() => onAICommand && onAICommand('test', { range, code: match[0] })]
                    }
                });

                // Add Docs
                lenses.push({
                    range,
                    id: "docs",
                    command: {
                        id: commandId!,
                        title: "$(book) Add Docs",
                        arguments: [() => onAICommand && onAICommand('docs', { range, code: match[0] })]
                    }
                });

                // Refactor
                lenses.push({
                    range,
                    id: "refactor",
                    command: {
                        id: commandId!,
                        title: "$(wand) Refactor",
                        arguments: [() => onAICommand && onAICommand('refactor', { range, code: match[0] })]
                    }
                });
            }
            return { lenses, dispose: () => {} };
        }
    });
    disposablesRef.current.push(lensProvider);

    // --- 4. Inline Quick Fix (Lightbulb) ---
    const codeActionProvider = monaco.languages.registerCodeActionProvider(getMonacoLanguage(language), {
        provideCodeActions: (model, range, context) => {
            if (context.markers.length === 0) return { actions: [], dispose: () => {} };

            const actions = context.markers.map(marker => ({
                title: `✨ Fix with Vibe AI: ${marker.message}`,
                diagnostics: [marker],
                kind: "quickfix",
                isPreferred: true,
                command: {
                    id: commandId!,
                    title: "Fix with Vibe AI",
                    arguments: [() => onAICommand && onAICommand('fix', { error: marker.message, range: marker, code: model.getValueInRange(marker) })]
                }
            }));

            return { actions, dispose: () => {} };
        }
    });
    disposablesRef.current.push(codeActionProvider);


    // Keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
        if (onUndo) onUndo();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
        if (onRedo) onRedo();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (onSave) onSave();
    });

    // Cmd+K for Inline AI
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        const position = editor.getPosition();
        if (position) {
            const scrolledPos = editor.getScrolledVisiblePosition(position);
            const selection = editor.getSelection();
            if (scrolledPos) {
                setInlineInputPos({ 
                    top: scrolledPos.top, 
                    left: scrolledPos.left, 
                    lineHeight: 20 // Approx line height
                });
                setSavedSelection(selection);
            }
        }
    });

    // Event Listeners
    editor.onDidChangeCursorPosition((e: any) => {
      const offset = editor.getModel()?.getOffsetAt(e.position) || 0;
      if (onCursorChange) onCursorChange(offset);
    });

    editor.onDidChangeCursorSelection((e: any) => {
        const selection = editor.getModel()?.getValueInRange(e.selection);
        if (onSelectionChange) onSelectionChange(selection || '');
    });
  };
  
  // Cleanup providers on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach(d => d.dispose());
      providerRef.current?.dispose();
    }
  }, []);

  const handleInlineSubmit = async (text: string) => {
      if (!onInlineAssist || !savedSelection) return;
      setIsProcessingInline(true);
      try {
          await onInlineAssist(text, savedSelection);
          setInlineInputPos(null);
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessingInline(false);
          editorRef.current?.focus();
      }
  };

  // --- Diagnostics ---
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    
    if (model && diagnostics) {
        const markers = diagnostics.map(d => ({
            severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
            message: d.message,
            startLineNumber: d.startLine,
            startColumn: d.startColumn,
            endLineNumber: d.endLine,
            endColumn: d.endColumn,
            source: 'Vibe Lint'
        }));
        monaco.editor.setModelMarkers(model, 'owner', markers);
    }
  }, [diagnostics]);

  // Keep ref for disposable cleanup of standard inline completion if needed
  const providerRef = useRef<any>(null);

  return (
    <div className={`flex h-full w-full overflow-hidden rounded-2xl ${className || ''}`}>
      {/* Editor Pane */}
      <div className={`relative h-full transition-all duration-300 ${showPreview ? 'w-1/2 border-r border-vibe-border' : 'w-full'}`}>
         
         <InlineInput 
            position={inlineInputPos} 
            onClose={() => setInlineInputPos(null)} 
            onSubmit={handleInlineSubmit}
            isProcessing={isProcessingInline}
         />

         <Editor
            height="100%"
            language={getMonacoLanguage(language)}
            value={code}
            onChange={(value) => onChange(value || '')}
            onMount={handleEditorDidMount}
            theme={theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme'}
            options={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 14,
                lineHeight: 22,
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                folding: true,
                roundedSelection: true,
                renderLineHighlight: 'all',
                contextmenu: true,
                bracketPairColorization: { enabled: true },
                padding: { top: 20, bottom: 20 },
                inlineSuggest: { enabled: true },
                suggest: {
                    showWords: false
                },
                // Enable CodeLens
                codeLens: true,
                // Enable Lightbulb
                lightbulb: { enabled: 'on' }
            }}
         />
      </div>
       {showPreview && (
          <div className="w-1/2 h-full flex flex-col bg-white/5 animate-in slide-in-from-right-5 fade-in duration-300 backdrop-blur-sm border-l border-vibe-border">
              <iframe 
                  ref={iframeRef}
                  className="w-full h-full border-none bg-white"
                  srcDoc={previewContent}
                  title="Live Preview"
                  sandbox="allow-scripts allow-modals" 
              />
          </div>
       )}
    </div>
  );
};

export default CodeEditor;