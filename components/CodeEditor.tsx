
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Diagnostic, AIPatch } from '../types';
import { InlineInput } from './InlineInput';
import { vibeDarkTheme, vibeLightTheme } from '../utils/monacoThemes';
import { getMonacoLanguage } from '../utils/editorUtils';
import { useInlineCompletion } from './editor/hooks/useInlineCompletion';
import { useSemanticAutocomplete } from './editor/hooks/useSemanticAutocomplete';
import { useCodeLens } from './editor/hooks/useCodeLens';
import { useQuickFix } from './editor/hooks/useQuickFix';
import { useAICommand } from './editor/hooks/useAICommand';
import { useAgentStore } from '../stores/agentStore';
import { useFileTreeStore } from '../stores/fileStore';
import { ResizablePanel } from './ResizablePanel';

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
  showPreview?: boolean;
  previewContent?: string;
  diagnostics?: Diagnostic[];
  onInlineAssist?: (instruction: string, range: any) => Promise<void>;
  onAICommand?: (type: 'test' | 'docs' | 'refactor' | 'fix', context: any) => void;
}

// --- Enhanced AI Patch Widget ---

class AIPatchWidget implements monaco.editor.IContentWidget {
  private domNode: HTMLDivElement | null = null;

  constructor(
    private editor: monaco.editor.IStandaloneCodeEditor,
    public patch: AIPatch,
    private onAccept: () => void,
    private onReject: () => void
  ) {}

  getId() {
    return `ai.patch.${this.patch.id}`;
  }

  getDomNode() {
    if (!this.domNode) {
      const isNewFile = this.patch.originalText === '';
      this.domNode = document.createElement('div');
      this.domNode.className = 'ai-patch-widget animate-in fade-in slide-in-from-top-2 duration-300';
      
      this.domNode.style.cssText = `
        display: flex;
        gap: 6px;
        background: rgba(15, 15, 24, 0.9);
        backdrop-filter: blur(16px);
        border: 1px solid ${isNewFile ? 'rgba(34, 197, 94, 0.4)' : 'rgba(129, 140, 248, 0.4)'};
        border-radius: 10px;
        padding: 4px 8px;
        box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.7);
        pointer-events: auto;
        z-index: 100;
        transform: translateY(4px);
      `;

      const label = document.createElement('div');
      label.style.cssText = `
        color: ${isNewFile ? '#4ade80' : '#818cf8'};
        font-size: 9px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        padding-right: 6px;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
      `;
      label.textContent = isNewFile ? 'AI New' : 'AI Edit';

      const btnStyle = 'padding: 2px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;';
      
      const keep = document.createElement('button');
      keep.textContent = 'Keep';
      keep.style.cssText = btnStyle + 'background: rgba(34, 197, 94, 0.15); color: #4ade80; border-color: rgba(34, 197, 94, 0.2);';
      keep.onclick = (e) => { e.stopPropagation(); this.onAccept(); };
      keep.onmouseover = () => { keep.style.background = 'rgba(34, 197, 94, 0.3)'; };
      keep.onmouseout = () => { keep.style.background = 'rgba(34, 197, 94, 0.15)'; };

      const reject = document.createElement('button');
      reject.textContent = 'Reject';
      reject.style.cssText = btnStyle + 'background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.2);';
      reject.onclick = (e) => { e.stopPropagation(); this.onReject(); };
      reject.onmouseover = () => { reject.style.background = 'rgba(239, 68, 68, 0.3)'; };
      reject.onmouseout = () => { reject.style.background = 'rgba(239, 68, 68, 0.15)'; };

      this.domNode.append(label, keep, reject);
    }
    return this.domNode;
  }

  getPosition() {
    return {
      position: {
        lineNumber: this.patch.range.endLineNumber,
        column: this.patch.range.endColumn
      },
      preference: [
        monaco.editor.ContentWidgetPositionPreference.BELOW
      ]
    };
  }

  updatePatch(newPatch: AIPatch) {
      this.patch = newPatch;
  }
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
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<typeof monaco | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [inlineInputPos, setInlineInputPos] = useState<{ top: number; left: number; lineHeight: number } | null>(null);
  const [isProcessingInline, setIsProcessingInline] = useState(false);
  const [savedSelection, setSavedSelection] = useState<any>(null);

  const patches = useAgentStore(state => state.patches);
  const acceptPatch = useAgentStore(state => state.acceptPatch);
  const rejectPatch = useAgentStore(state => state.rejectPatch);
  const activeFileId = useFileTreeStore(state => state.activeFileId);
  
  const activePatches = useMemo(() => 
    patches.filter(p => p.fileId === activeFileId && p.status === 'pending'), 
    [patches, activeFileId]
  );
  
  const decorationIdsRef = useRef<string[]>([]);
  const widgetsRef = useRef<Map<string, AIPatchWidget>>(new Map());

  const mappedLanguage = getMonacoLanguage(language);

  const commandId = useAICommand(editor);
  useInlineCompletion(monacoInstance, editor, mappedLanguage, onFetchSuggestion);
  useSemanticAutocomplete(monacoInstance, editor, mappedLanguage);
  useCodeLens(monacoInstance, editor, mappedLanguage, commandId, onAICommand);
  useQuickFix(monacoInstance, editor, mappedLanguage, commandId, onAICommand);

  // --- Incremental AI Patches Effect ---
  useEffect(() => {
    if (!editor || !monacoInstance) return;

    const model = editor.getModel();
    if (!model) return;

    const currentPatchIds = new Set(activePatches.map(p => p.id));
    
    // 1. Remove widgets for patches that no longer exist
    widgetsRef.current.forEach((widget, id) => {
        if (!currentPatchIds.has(id)) {
            editor.removeContentWidget(widget);
            widgetsRef.current.delete(id);
        }
    });

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    activePatches.forEach(patch => {
      const currentTextInRange = model.getValueInRange(patch.range);
      const isNewFile = patch.originalText === '';

      // Preview patch text
      if (currentTextInRange !== patch.proposedText) {
          editor.executeEdits('ai-vibe', [{
              range: patch.range,
              text: patch.proposedText
          }]);
      }

      const decorationRange = isNewFile ? model.getFullModelRange() : patch.range;

      newDecorations.push({
        range: decorationRange,
        options: {
          className: isNewFile ? 'ai-diff-added' : 'ai-diff-modified',
          isWholeLine: false,
          glyphMarginClassName: isNewFile ? 'ai-diff-glyph-added' : 'ai-diff-glyph',
          overviewRuler: {
            color: isNewFile ? '#22c55e' : '#a371f7',
            position: monaco.editor.OverviewRulerLane.Left
          }
        }
      });

      // 2. Add or update Content Widgets incrementally
      let widget = widgetsRef.current.get(patch.id);
      if (!widget) {
          widget = new AIPatchWidget(
            editor,
            patch,
            () => acceptPatch(patch.id),
            () => {
                editor.executeEdits('ai-vibe-revert', [{
                    range: model.getFullModelRange(), 
                    text: patch.originalText
                }]);
                rejectPatch(patch.id);
            }
          );
          editor.addContentWidget(widget);
          widgetsRef.current.set(patch.id, widget);
      } else {
          // If range changed, layout it
          const oldPos = widget.getPosition().position;
          if (oldPos.lineNumber !== patch.range.endLineNumber || oldPos.column !== patch.range.endColumn) {
              widget.updatePatch(patch);
              editor.layoutContentWidget(widget);
          }
      }
    });

    // 3. Update Decorations using deltaDecorations (built-in incremental update)
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, newDecorations);

  }, [activePatches, editor, monacoInstance, acceptPatch, rejectPatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        if (editor) {
            widgetsRef.current.forEach(w => editor.removeContentWidget(w));
            widgetsRef.current.clear();
        }
    };
  }, [editor]);

  // --- Theme & Diagnostics ---
  useEffect(() => {
    if (monacoInstance) {
      monacoInstance.editor.setTheme(theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme');
    }
  }, [theme, monacoInstance]);

  useEffect(() => {
    if (!editor || !monacoInstance) return;
    const model = editor.getModel();
    if (model && diagnostics) {
        const markers = diagnostics.map(d => ({
            severity: d.severity === 'error' ? monacoInstance.MarkerSeverity.Error : monacoInstance.MarkerSeverity.Warning,
            message: d.message,
            startLineNumber: d.startLine,
            startColumn: d.startColumn,
            endLineNumber: d.endLine,
            endColumn: d.endColumn,
            source: 'Vibe Lint'
        }));
        monacoInstance.editor.setModelMarkers(model, 'owner', markers);
    }
  }, [diagnostics, editor, monacoInstance]);

  const handleEditorDidMount: OnMount = (editorInstance, monacoInst) => {
    setEditor(editorInstance);
    setMonacoInstance(monacoInst);

    monacoInst.editor.defineTheme('vibe-dark-theme', vibeDarkTheme);
    monacoInst.editor.defineTheme('vibe-light-theme', vibeLightTheme);
    
    // Fix: Use imported monaco constants instead of instance-based ones for stable type inference.
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => onUndo?.());
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => onRedo?.());
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave?.());

    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        const position = editorInstance.getPosition();
        if (position) {
            const scrolledPos = editorInstance.getScrolledVisiblePosition(position);
            const selection = editorInstance.getSelection();
            // Fix: Use imported monaco.editor.EditorOption to ensure correct type for option lookup.
            const lineHeight = editorInstance.getOption(monaco.editor.EditorOption.lineHeight);
            
            if (scrolledPos) {
                setInlineInputPos({ 
                    top: scrolledPos.top, 
                    left: scrolledPos.left, 
                    lineHeight: lineHeight
                });
                setSavedSelection(selection);
            }
        }
    });

    editorInstance.onDidChangeCursorPosition((e: any) => {
      const offset = editorInstance.getModel()?.getOffsetAt(e.position) || 0;
      onCursorChange?.(offset);
    });

    editorInstance.onDidChangeCursorSelection((e: any) => {
        const selection = editorInstance.getModel()?.getValueInRange(e.selection);
        onSelectionChange?.(selection || '');
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
          editor?.focus();
      }
  };

  return (
    <ResizablePanel
      className={`rounded-2xl ${className || ''}`}
      isSideVisible={showPreview}
      mainContent={
        <div className="h-full w-full relative">
           <InlineInput 
              position={inlineInputPos} 
              onClose={() => setInlineInputPos(null)} 
              onSubmit={handleInlineSubmit}
              isProcessing={isProcessingInline}
           />

           <Editor
              height="100%"
              language={mappedLanguage}
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
                  suggest: { showWords: false },
                  codeLens: true,
                  lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.On },
              }}
           />
        </div>
      }
      sideContent={
        <iframe 
            ref={iframeRef}
            className="w-full h-full border-none"
            srcDoc={previewContent}
            title="Live Preview"
            sandbox="allow-scripts allow-modals" 
        />
      }
    />
  );
};

export default CodeEditor;
