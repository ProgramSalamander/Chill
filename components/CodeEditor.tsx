

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { createPortal } from 'react-dom';
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
  onFetchSuggestion: (code: string, offset: number, signal?: AbortSignal) => Promise<string | null>;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  diagnostics?: Diagnostic[];
  onInlineAssist?: (instruction: string, range: any) => Promise<void>;
  onAICommand?: (type: 'test' | 'docs' | 'refactor' | 'fix', context: any) => void;
}

// --- React Component for AI Patch Widget ---

const AIPatchComponent: React.FC<{ 
  patch: AIPatch; 
  onAccept: () => void; 
  onReject: () => void; 
}> = ({ patch, onAccept, onReject }) => {
  const isNewFile = patch.originalText === '';
  
  return (
    <div className="flex items-center gap-2 p-1.5 bg-[#0f0f16]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 ring-1 ring-white/5 select-none pointer-events-auto">
      <div className={`
        px-2 text-[10px] font-black uppercase tracking-widest border-r border-white/10 flex items-center h-full
        ${isNewFile ? 'text-green-400' : 'text-indigo-400'}
      `}>
        {isNewFile ? 'AI New' : 'AI Edit'}
      </div>
      
      <button 
        onClick={(e) => { e.stopPropagation(); onAccept(); }}
        className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 border border-green-500/20 hover:shadow-[0_0_10px_rgba(74,222,128,0.2)] cursor-pointer"
      >
        Keep
      </button>
      
      <button 
        onClick={(e) => { e.stopPropagation(); onReject(); }}
        className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 hover:shadow-[0_0_10px_rgba(248,113,113,0.2)] cursor-pointer"
      >
        Reject
      </button>
    </div>
  );
};

// --- Content Widget Class ---

class AIPatchWidget implements monaco.editor.IContentWidget {
  constructor(
    private editor: monaco.editor.IStandaloneCodeEditor,
    public patch: AIPatch,
    private domNode: HTMLDivElement
  ) {}

  getId() {
    return `ai.patch.${this.patch.id}`;
  }

  getDomNode() {
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
  diagnostics = [],
  onInlineAssist,
  onAICommand
}) => {
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<typeof monaco | null>(null);
  
  const [inlineAnchor, setInlineAnchor] = useState<monaco.IPosition | null>(null);
  const [inlineWidgetDom, setInlineWidgetDom] = useState<HTMLDivElement | null>(null);
  const [isProcessingInline, setIsProcessingInline] = useState(false);
  const [savedSelection, setSavedSelection] = useState<any>(null);

  // State to track DOM nodes for React Portals
  const [widgetMap, setWidgetMap] = useState<Map<string, HTMLDivElement>>(new Map());

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

  // --- Inline Input Widget Logic ---
  useEffect(() => {
    if (!editor || !inlineAnchor) {
        setInlineWidgetDom(null);
        return;
    }
    
    const id = 'vibe.inline-input';
    const domNode = document.createElement('div');
    domNode.style.zIndex = '50';
    domNode.className = 'pointer-events-auto'; 
    setInlineWidgetDom(domNode);

    const widget: monaco.editor.IContentWidget = {
        getId: () => id,
        getDomNode: () => domNode,
        getPosition: () => ({
            position: inlineAnchor,
            preference: [monaco.editor.ContentWidgetPositionPreference.BELOW]
        })
    };

    editor.addContentWidget(widget);
    editor.layoutContentWidget(widget);

    return () => {
        editor.removeContentWidget(widget);
    };
  }, [editor, inlineAnchor]);

  // --- Incremental AI Patches Effect ---
  useEffect(() => {
    if (!editor || !monacoInstance) return;

    const model = editor.getModel();
    if (!model) return;

    const currentPatchIds = new Set(activePatches.map(p => p.id));
    let mapChanged = false;
    const newMap = new Map(widgetMap);
    
    // 1. Remove widgets for patches that no longer exist
    widgetsRef.current.forEach((widget, id) => {
        if (!currentPatchIds.has(id)) {
            editor.removeContentWidget(widget);
            widgetsRef.current.delete(id);
            newMap.delete(id);
            mapChanged = true;
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
          const domNode = document.createElement('div');
          // Important: 'pointer-events-auto' allows the React component inside to receive clicks
          domNode.className = 'pointer-events-auto z-50'; 
          
          widget = new AIPatchWidget(editor, patch, domNode);
          editor.addContentWidget(widget);
          widgetsRef.current.set(patch.id, widget);
          
          newMap.set(patch.id, domNode);
          mapChanged = true;
      } else {
          // If range changed, layout it
          const oldPos = widget.getPosition().position;
          if (oldPos?.lineNumber !== patch.range.endLineNumber || oldPos?.column !== patch.range.endColumn) {
              widget.updatePatch(patch);
              editor.layoutContentWidget(widget);
          }
      }
    });

    // 3. Update Decorations
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, newDecorations);

    if (mapChanged) {
        setWidgetMap(newMap);
    }

  }, [activePatches, editor, monacoInstance]);

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
    
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => onUndo?.());
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => onRedo?.());
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave?.());

    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        const position = editorInstance.getPosition();
        const selection = editorInstance.getSelection();
        
        if (position) {
            setInlineAnchor(position);
            setSavedSelection(selection);
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
          setInlineAnchor(null);
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessingInline(false);
          editor?.focus();
      }
  };

  return (
    <div className={`h-full w-full relative ${className || ''}`}>
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
       {/* Inline Input Widget Portal */}
       {inlineWidgetDom && createPortal(
          <InlineInput 
              onClose={() => setInlineAnchor(null)}
              onSubmit={handleInlineSubmit}
              isProcessing={isProcessingInline}
          />,
          inlineWidgetDom
       )}
       
       {/* AI Patch Widgets Portals */}
       {activePatches.map(patch => {
           const node = widgetMap.get(patch.id);
           if (!node) return null;
           return createPortal(
               <AIPatchComponent 
                   patch={patch} 
                   onAccept={() => acceptPatch(patch.id)} 
                   onReject={() => {
                        // Revert text in editor before removing the patch
                        if (editor) {
                            const model = editor.getModel();
                            if (model) {
                                editor.executeEdits('ai-vibe-revert', [{
                                    range: model.getFullModelRange(), 
                                    text: patch.originalText
                                }]);
                            }
                        }
                        rejectPatch(patch.id);
                   }} 
               />, 
               node
           );
       })}
    </div>
  );
};

export default CodeEditor;