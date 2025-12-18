import React, { useRef, useEffect, useState, useMemo } from 'react';
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

// --- Content Widget for AI Patches ---

class AIPatchWidget implements monaco.editor.IContentWidget {
  private domNode: HTMLDivElement | null = null;

  constructor(
    private editor: monaco.editor.IStandaloneCodeEditor,
    private patch: AIPatch,
    private onAccept: () => void,
    private onReject: () => void
  ) {}

  getId() {
    return `ai.patch.${this.patch.id}`;
  }

  getDomNode() {
    if (!this.domNode) {
      this.domNode = document.createElement('div');
      this.domNode.className = 'ai-patch-widget';

      const keep = document.createElement('button');
      keep.textContent = 'Keep';
      keep.className = 'btn-keep';
      keep.onclick = (e) => { e.stopPropagation(); this.onAccept(); };

      const reject = document.createElement('button');
      reject.textContent = 'Reject';
      reject.className = 'btn-reject';
      reject.onclick = (e) => { e.stopPropagation(); this.onReject(); };

      this.domNode.append(keep, reject);
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
  // State for editor instances
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<typeof monaco | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Inline Input State
  const [inlineInputPos, setInlineInputPos] = useState<{ top: number; left: number; lineHeight: number } | null>(null);
  const [isProcessingInline, setIsProcessingInline] = useState(false);
  const [savedSelection, setSavedSelection] = useState<any>(null);

  // AI Patches Tracking
  const patches = useAgentStore(state => state.patches);
  const acceptPatch = useAgentStore(state => state.acceptPatch);
  const rejectPatch = useAgentStore(state => state.rejectPatch);
  const activeFileId = useFileTreeStore(state => state.activeFileId);
  const activePatches = useMemo(() => patches.filter(p => p.fileId === activeFileId && p.status === 'pending'), [patches, activeFileId]);
  
  const decorationIdsRef = useRef<string[]>([]);
  const widgetsRef = useRef<Map<string, AIPatchWidget>>(new Map());

  const mappedLanguage = getMonacoLanguage(language);

  // --- Initialize Hooks for Editor Features ---
  
  const commandId = useAICommand(editor);
  useInlineCompletion(monacoInstance, editor, mappedLanguage, onFetchSuggestion);
  useSemanticAutocomplete(monacoInstance, editor, mappedLanguage);
  useCodeLens(monacoInstance, editor, mappedLanguage, commandId, onAICommand);
  useQuickFix(monacoInstance, editor, mappedLanguage, commandId, onAICommand);

  // --- AI Patches Effect ---
  useEffect(() => {
    if (!editor || !monacoInstance) return;

    const model = editor.getModel();
    if (!model) return;

    // 1. Cleanup old decorations and widgets
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
    widgetsRef.current.forEach(widget => editor.removeContentWidget(widget));
    widgetsRef.current.clear();

    // 2. Apply current patches
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    activePatches.forEach(patch => {
      // Step 1: Temporarily apply text if not already matching
      const currentTextInRange = model.getValueInRange(patch.range);
      if (currentTextInRange !== patch.proposedText) {
          editor.executeEdits('ai-vibe', [{
              range: patch.range,
              text: patch.proposedText
          }]);
      }

      // Step 2: Add visual markers
      newDecorations.push({
        range: patch.range,
        options: {
          className: 'ai-diff-modified',
          isWholeLine: false,
          glyphMarginClassName: 'ai-diff-glyph',
          overviewRuler: {
            color: '#a371f7',
            position: monaco.editor.OverviewRulerLane.Left
          }
        }
      });

      // Step 3: Add Widget
      const widget = new AIPatchWidget(
        editor,
        patch,
        () => acceptPatch(patch.id),
        () => {
            // Revert text before rejecting in store
            editor.executeEdits('ai-vibe-revert', [{
                range: patch.range,
                text: patch.originalText
            }]);
            rejectPatch(patch.id);
        }
      );
      editor.addContentWidget(widget);
      widgetsRef.current.set(patch.id, widget);
    });

    decorationIdsRef.current = editor.deltaDecorations([], newDecorations);

    return () => {
        // Final cleanup
        decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
        widgetsRef.current.forEach(widget => editor.removeContentWidget(widget));
        widgetsRef.current.clear();
    };
  }, [activePatches, editor, monacoInstance, acceptPatch, rejectPatch]);

  // --- Theme Handling ---
  useEffect(() => {
    if (monacoInstance) {
      monacoInstance.editor.setTheme(theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme');
    }
  }, [theme, monacoInstance]);

  // --- Diagnostics Handling ---
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

    // --- Define Custom Themes ---
    monacoInst.editor.defineTheme('vibe-dark-theme', vibeDarkTheme);
    monacoInst.editor.defineTheme('vibe-light-theme', vibeLightTheme);
    monacoInst.editor.setTheme(theme === 'dark' ? 'vibe-dark-theme' : 'vibe-light-theme');
    
    // --- Keybindings ---
    editorInstance.addCommand(monacoInst.KeyMod.CtrlCmd | monacoInst.KeyCode.KeyZ, () => {
        if (onUndo) onUndo();
    });

    editorInstance.addCommand(monacoInst.KeyMod.CtrlCmd | monacoInst.KeyMod.Shift | monacoInst.KeyCode.KeyZ, () => {
        if (onRedo) onRedo();
    });

    editorInstance.addCommand(monacoInst.KeyMod.CtrlCmd | monacoInst.KeyCode.KeyS, () => {
        if (onSave) onSave();
    });

    // Cmd+K for Inline AI
    editorInstance.addCommand(monacoInst.KeyMod.CtrlCmd | monacoInst.KeyCode.KeyK, () => {
        const position = editorInstance.getPosition();
        if (position) {
            const scrolledPos = editorInstance.getScrolledVisiblePosition(position);
            const selection = editorInstance.getSelection();
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

    // --- Event Listeners ---
    editorInstance.onDidChangeCursorPosition((e: any) => {
      const offset = editorInstance.getModel()?.getOffsetAt(e.position) || 0;
      if (onCursorChange) onCursorChange(offset);
    });

    editorInstance.onDidChangeCursorSelection((e: any) => {
        const selection = editorInstance.getModel()?.getValueInRange(e.selection);
        if (onSelectionChange) onSelectionChange(selection || '');
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
                suggest: {
                    showWords: false
                },
                // Enable CodeLens
                codeLens: true,
                lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.On },
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