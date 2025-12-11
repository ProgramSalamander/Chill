import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Diagnostic } from '../types';
import { InlineInput } from './InlineInput';

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
  // Live Preview Props
  showPreview?: boolean;
  previewContent?: string;
  diagnostics?: Diagnostic[];
  // Inline AI
  onInlineAssist?: (instruction: string, range: any) => Promise<void>;
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
  showPreview = false,
  previewContent = '',
  diagnostics = [],
  onInlineAssist
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const providerRef = useRef<any>(null);
  
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
    
    // --- Inline Completions Provider ---
    providerRef.current = monaco.languages.registerInlineCompletionsProvider(getMonacoLanguage(language), {
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

    // Keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
        if (onUndo) onUndo();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
        if (onRedo) onRedo();
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
  
  // Cleanup provider on unmount
  useEffect(() => {
    return () => {
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
                }
            }}
         />
      </div>
       {showPreview && (
          // This part is unchanged, but included for completeness
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