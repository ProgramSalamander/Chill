
import React, { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import { IconRefresh } from './Icons';
import { Diagnostic } from '../types';
import { InlineInput } from './InlineInput';

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (newCode: string) => void;
  className?: string;
  cursorOffset?: number;
  onCursorChange?: (position: number) => void;
  onSelectionChange?: (selection: string) => void;
  suggestion?: string | null;
  onAcceptSuggestion?: () => void;
  onTriggerSuggestion?: () => void;
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
  onChange, 
  className, 
  cursorOffset = 0,
  onCursorChange,
  onSelectionChange,
  suggestion,
  onAcceptSuggestion,
  onTriggerSuggestion,
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
  const decorationsRef = useRef<string[]>([]);
  
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

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // --- Vibe Theme Definition ---
    monaco.editor.defineTheme('vibe-theme', {
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
        'editor.background': '#05050800', // Transparent for glass effect
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#181824',
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

    monaco.editor.setTheme('vibe-theme');

    // Context key for suggestion visibility to bind Tab key
    const suggestionVisible = editor.createContextKey('suggestionVisible', false);

    // Keybindings
    editor.addCommand(monaco.KeyCode.Tab, () => {
       if (onAcceptSuggestion) onAcceptSuggestion();
    }, 'suggestionVisible');

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
       if (onTriggerSuggestion) onTriggerSuggestion();
    });

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
      
      // Close inline input on cursor move if it's open (optional UX choice)
      // setInlineInputPos(null);
      
      // Sync suggestion visibility context
      suggestionVisible.set(!!suggestion);
    });

    editor.onDidChangeCursorSelection((e: any) => {
        const selection = editor.getModel()?.getValueInRange(e.selection);
        if (onSelectionChange && selection) onSelectionChange(selection);
        if (onSelectionChange && !selection) onSelectionChange('');
    });
  };

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

  // --- Suggestion / Ghost Text ---
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (suggestion) {
        const position = editor.getPosition();
        if (position) {
            const newDecorations = [
                {
                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                    options: {
                        after: {
                            content: suggestion,
                            inlineClassName: 'ghost-text',
                        },
                        description: 'ai-suggestion'
                    }
                }
            ];
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
        }
    } else {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
  }, [suggestion]);

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


  const handleRefreshPreview = () => {
    if (iframeRef.current) {
        const content = iframeRef.current.srcdoc;
        iframeRef.current.srcdoc = '';
        setTimeout(() => {
            if (iframeRef.current) iframeRef.current.srcdoc = content;
        }, 10);
    }
  };

  return (
    <div className={`flex h-full w-full overflow-hidden rounded-2xl ${className || ''}`}>
      {/* Editor Pane */}
      <div className={`relative h-full transition-all duration-300 ${showPreview ? 'w-1/2 border-r border-white/10' : 'w-full'}`}>
         
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
            theme="vibe-theme"
            options={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 14,
                lineHeight: 22,
                fontLigatures: true,
                minimap: { enabled: false }, // Keep it clean
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
                suggest: {
                    showWords: false // Let AI handle most or use native Intellisense
                }
            }}
         />
      </div>

       {/* Live Preview Pane */}
       {showPreview && (
            <div className="w-1/2 h-full flex flex-col bg-white/5 animate-in slide-in-from-right-5 fade-in duration-300 backdrop-blur-sm border-l border-white/10">
                <div className="h-9 bg-black/20 border-b border-white/10 flex items-center justify-between px-3 select-none">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                            Live Preview
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 hidden sm:inline-block">
                           Auto-updates
                        </span>
                        <button 
                            onClick={handleRefreshPreview}
                            className="p-1 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                            title="Refresh Preview"
                        >
                            <IconRefresh size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-white relative">
                    <iframe 
                        ref={iframeRef}
                        className="absolute inset-0 w-full h-full border-none"
                        srcDoc={previewContent}
                        title="Live Preview"
                        sandbox="allow-scripts allow-modals" 
                    />
                </div>
            </div>
        )}
    </div>
  );
};

export default CodeEditor;
