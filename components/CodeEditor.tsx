
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
// We need to import Prism specifically to use it for highlighting
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import { IconRefresh } from './Icons';
import { Diagnostic } from '../types';

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
  diagnostics = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [hoveredDiagnostic, setHoveredDiagnostic] = useState<Diagnostic | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{x: number, y: number} | null>(null);
  const [charWidth, setCharWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.font = '14px "JetBrains Mono", monospace';
            const metrics = ctx.measureText('M');
            setCharWidth(metrics.width);
        }
    };
    
    document.fonts.ready.then(measure);
    measure();
  }, []);

  // Map our internal language keys to Prism keys
  const getPrismLanguage = (lang: string) => {
    const map: Record<string, any> = {
      'typescript': Prism.languages.typescript,
      'javascript': Prism.languages.javascript,
      'html': Prism.languages.html,
      'css': Prism.languages.css,
      'json': Prism.languages.json,
      'python': Prism.languages.python,
    };
    return map[lang] || Prism.languages.javascript;
  };

  const handleStateChange = useCallback((e: React.SyntheticEvent<any>) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    const val = target.value || '';
    const start = target.selectionStart;
    const end = target.selectionEnd;

    if (onCursorChange) {
      onCursorChange(start);
    }

    if (onSelectionChange) {
      // If start === end, selection is collapsed (empty)
      const selectedText = start !== end ? val.substring(start, end) : '';
      onSelectionChange(selectedText);
    }
  }, [onCursorChange, onSelectionChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<any>) => {
    // Tab for completion
    if (e.key === 'Tab' && suggestion && onAcceptSuggestion) {
      e.preventDefault();
      onAcceptSuggestion();
      return;
    }

    // Manual Trigger: Ctrl+Space or Cmd+Space
    if ((e.metaKey || e.ctrlKey) && e.key === ' ') {
      e.preventDefault();
      onTriggerSuggestion?.();
      return;
    }

    // Undo: Ctrl+Z or Cmd+Z
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      onUndo?.();
      return;
    }

    // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y or Cmd+Y
    if (
      ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
      ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
    ) {
      e.preventDefault();
      onRedo?.();
      return;
    }
  }, [suggestion, onAcceptSuggestion, onTriggerSuggestion, onUndo, onRedo]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
     if (!contentRef.current || charWidth === 0) return;
     
     const rect = contentRef.current.getBoundingClientRect();
     const x = e.clientX - rect.left - 20; // 20px padding
     const y = e.clientY - rect.top - 20; // 20px padding
     
     if (x < 0 || y < 0) {
         setHoveredDiagnostic(null);
         return;
     }

     const lineHeight = 14 * 1.5;
     const line = Math.floor(y / lineHeight) + 1;
     const col = Math.floor(x / charWidth) + 1;

     const found = diagnostics.find(d => {
         if (line < d.startLine || line > d.endLine) return false;
         
         if (d.startLine === d.endLine) {
             return col >= d.startColumn && col < d.endColumn; 
         }
         
         if (line === d.startLine) return col >= d.startColumn;
         if (line === d.endLine) return col < d.endColumn;
         return true; 
     });

     if (found) {
         setHoveredDiagnostic(found);
         setTooltipPos({
             x: e.clientX - rect.left,
             y: (line * lineHeight) + 20 
         });
     } else {
         setHoveredDiagnostic(null);
     }
  };

  const handleMouseLeave = () => {
      setHoveredDiagnostic(null);
  };

  const handleRefreshPreview = () => {
    if (iframeRef.current) {
        // Force refresh by resetting srcDoc
        const content = iframeRef.current.srcdoc;
        iframeRef.current.srcdoc = '';
        setTimeout(() => {
            if (iframeRef.current) iframeRef.current.srcdoc = content;
        }, 10);
    }
  };

  // Convert line/column to index
  const getIndexFromPos = (line: number, col: number, code: string): number => {
    const lines = code.split('\n');
    let index = 0;
    for (let i = 0; i < line - 1; i++) {
        index += lines[i].length + 1; // +1 for newline
    }
    return index + (col - 1);
  };

  // Build content segments for diagnostics overlay
  const diagnosticSegments = useMemo(() => {
    if (!diagnostics || diagnostics.length === 0) return [{ text: code, isError: false }];

    // Sort diagnostics by start position
    const sorted = [...diagnostics].sort((a, b) => {
        const idxA = getIndexFromPos(a.startLine, a.startColumn, code);
        const idxB = getIndexFromPos(b.startLine, b.startColumn, code);
        return idxA - idxB;
    });

    const segments: { text: string; isError: boolean }[] = [];
    let currentIndex = 0;

    for (const diag of sorted) {
        const startIdx = getIndexFromPos(diag.startLine, diag.startColumn, code);
        const endIdx = getIndexFromPos(diag.endLine, diag.endColumn, code);
        
        // Skip if out of order or invalid
        if (startIdx < currentIndex) continue;

        // Add clean text before error
        if (startIdx > currentIndex) {
            segments.push({ text: code.slice(currentIndex, startIdx), isError: false });
        }

        // Add error text
        segments.push({ text: code.slice(startIdx, endIdx), isError: true });
        currentIndex = endIdx;
    }

    // Add remaining text
    if (currentIndex < code.length) {
        segments.push({ text: code.slice(currentIndex), isError: false });
    }

    return segments;
  }, [code, diagnostics]);

  // Logic to split the code for the ghost overlay
  const prefix = code.slice(0, cursorOffset);
  const suffix = code.slice(cursorOffset);

  const commonStyles = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 14,
    lineHeight: '1.5', 
    tabSize: 2,
    whiteSpace: 'pre' as const
  };

  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const lines = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1), [lineCount]);
  
  const currentLineNumber = useMemo(() => {
    return code.slice(0, cursorOffset).split('\n').length;
  }, [code, cursorOffset]);

  return (
    <div className={`flex h-full w-full overflow-hidden rounded-2xl ${className || ''}`}>
        
        {/* Editor Pane */}
        <div ref={containerRef} className={`relative h-full font-mono text-sm overflow-auto transition-all duration-300 ${showPreview ? 'w-1/2 border-r border-white/10' : 'w-full'}`}>
            <div className="flex min-h-full min-w-full">
                
                {/* Gutter */}
                <div 
                  className="sticky left-0 z-40 flex flex-col items-end border-r border-white/5 text-slate-600 select-none py-[20px] p-4 text-xs bg-[#050508]"
                  style={{
                    fontFamily: commonStyles.fontFamily,
                    fontSize: commonStyles.fontSize,
                    lineHeight: commonStyles.lineHeight,
                    minWidth: '3.5rem',
                  }}
                >
                    {lines.map(i => (
                        <div 
                          key={i} 
                          className={`w-full text-right ${i === currentLineNumber ? 'text-vibe-glow font-bold' : 'hover:text-slate-400'}`}
                        >
                            {i}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div 
                    ref={contentRef}
                    className="relative flex-1 min-w-0"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    
                    {/* Diagnostics Overlay - Renders squiggles */}
                    <pre
                        className="absolute inset-0 pointer-events-none z-10"
                        aria-hidden="true"
                        style={{
                            ...commonStyles,
                            margin: 0,
                            border: 0,
                            background: 'none',
                            boxSizing: 'border-box',
                            padding: 20,
                            color: 'transparent',
                        }}
                    >
                        {diagnosticSegments.map((seg, i) => (
                            <span key={i} className={seg.isError ? "squiggle-error" : ""}>{seg.text}</span>
                        ))}
                    </pre>

                    {/* Ghost Overlay - For Suggestions */}
                    <pre 
                    className="absolute inset-0 pointer-events-none z-20"
                    aria-hidden="true"
                    style={{
                        ...commonStyles,
                        margin: 0,
                        border: 0,
                        background: 'none',
                        boxSizing: 'border-box',
                        padding: 20, 
                        color: 'transparent',
                    }}
                    >
                    <span>{prefix}</span>
                    {suggestion && (
                        <span className="text-vibe-glow opacity-50 relative italic">
                        {suggestion}
                        <span className="absolute -top-5 left-0 text-[10px] bg-vibe-accent text-white px-1.5 rounded shadow-lg font-sans whitespace-nowrap opacity-100 not-italic border border-white/10">
                            TAB
                        </span>
                        </span>
                    )}
                    <span>{suffix}</span>
                    </pre>

                    <Editor
                    value={code}
                    onValueChange={onChange}
                    highlight={(code) => Prism.highlight(code, getPrismLanguage(language), language)}
                    padding={20}
                    onKeyDown={handleKeyDown}
                    onSelect={handleStateChange}
                    onClick={handleStateChange}
                    onKeyUp={handleStateChange}
                    onMouseUp={handleStateChange}
                    textareaClassName="focus:outline-none z-30"
                    style={{
                        ...commonStyles,
                        backgroundColor: 'transparent',
                        minHeight: '100%',
                    }}
                    />

                    {/* Tooltip */}
                    {hoveredDiagnostic && tooltipPos && (
                        <div 
                            className="absolute z-50 bg-[#0f0f16]/90 backdrop-blur border border-red-500/30 rounded-lg shadow-2xl p-3 max-w-sm animate-in fade-in zoom-in-95 duration-100 pointer-events-none"
                            style={{
                                top: tooltipPos.y,
                                left: Math.min(tooltipPos.x, (contentRef.current?.clientWidth || 500) - 300),
                            }}
                        >
                            <div className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">✖</span>
                                <div>
                                    <div className="text-sm text-slate-200 font-medium">
                                        {hoveredDiagnostic.message}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                        <span>Line {hoveredDiagnostic.startLine}</span>
                                        <span className="text-vibe-glow">{hoveredDiagnostic.code || 'Error'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
