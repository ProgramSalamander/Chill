
import { useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { useUIStore } from '../../../stores/uiStore';

export const useInlineCompletion = (
  monacoInstance: typeof monaco | null,
  editorInstance: monaco.editor.IStandaloneCodeEditor | null,
  language: string,
  onFetchSuggestion: (code: string, offset: number) => Promise<string | null>
) => {
  useEffect(() => {
    if (!monacoInstance || !editorInstance) return;

    const provider = monacoInstance.languages.registerInlineCompletionsProvider(language, {
      debounceDelayMs: 400,
      provideInlineCompletions: async (model, position, context, token) => {
        const { inlineCompletionsEnabled, disabledInlineLanguages } = useUIStore.getState();

        // Check if disabled globally or for this specific language
        if (!inlineCompletionsEnabled || disabledInlineLanguages.includes(language)) {
          return { items: [] };
        }

        console.log('[CodeEditor] Inline completion triggered', { position, kind: context.triggerKind });
        
        if (token.isCancellationRequested) {
            return { items: [] };
        }

        const code = model.getValue();
        const offset = model.getOffsetAt(position);
        try {
            const suggestionText = await onFetchSuggestion(code, offset);
            
            if (suggestionText && !token.isCancellationRequested) {
                return {
                    items: [{
                        insertText: suggestionText,
                        range: {
                            startLineNumber: position.lineNumber,
                            startColumn: position.column,
                            endLineNumber: position.lineNumber,
                            endColumn: position.column,
                        },
                        completeBracketPairs: true,
                    }],
                    enableForwardStability: true,
                    suppressSuggestions: true,
                };
            }
        } catch (e) {
          console.error("[CodeEditor] Error fetching inline suggestion:", e);
        }
        return { items: [] };
      },
      disposeInlineCompletions: () => {},
    });

    return () => provider.dispose();
  }, [monacoInstance, editorInstance, language, onFetchSuggestion]);
};
