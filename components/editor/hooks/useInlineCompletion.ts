
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
      // Reduced from 400ms to 150ms for a more agile response
      debounceDelayMs: 150,
      provideInlineCompletions: async (model, position, context, token) => {
        const { inlineCompletionsEnabled, disabledInlineLanguages } = useUIStore.getState();

        // Check if disabled globally or for this specific language
        if (!inlineCompletionsEnabled || disabledInlineLanguages.includes(language)) {
          return { items: [] };
        }

        // Wrap the fetch logic in a Promise to use requestIdleCallback.
        // This ensures we only trigger the heavy AI/RAG call when the browser is idle,
        // preventing UI freezes if the user resumes typing immediately after the debounce.
        return new Promise((resolve) => {
            const work = async () => {
                // Double-check cancellation before starting the heavy lift
                if (token.isCancellationRequested) {
                    resolve({ items: [] });
                    return;
                }

                const code = model.getValue();
                const offset = model.getOffsetAt(position);
                
                try {
                    const suggestionText = await onFetchSuggestion(code, offset);
                    
                    if (suggestionText && !token.isCancellationRequested) {
                        resolve({
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
                        });
                        return;
                    }
                } catch (e) {
                  // Silent fail for completion errors to not disturb user flow
                }
                resolve({ items: [] });
            };

            // Use requestIdleCallback if available, falling back to a short timeout
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(work, { timeout: 200 });
            } else {
                setTimeout(work, 20);
            }
        });
      },
      disposeInlineCompletions: () => {},
    });

    return () => provider.dispose();
  }, [monacoInstance, editorInstance, language, onFetchSuggestion]);
};
