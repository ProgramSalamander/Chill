
import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useUIStore } from '../../../stores/uiStore';

export const useInlineCompletion = (
  monacoInstance: typeof monaco | null,
  editorInstance: monaco.editor.IStandaloneCodeEditor | null,
  language: string,
  onFetchSuggestion: (code: string, offset: number, signal: AbortSignal) => Promise<string | null>
) => {
  // Use a ref to store the last successful suggestion info for client-side sticky behavior
  const cacheRef = useRef<{
    prefix: string;      // The full text before the cursor at the moment of fetch
    suggestion: string;  // The suggested text returned by AI
  } | null>(null);

  // AbortController ref to cancel stale requests
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!monacoInstance || !editorInstance) return;

    const provider = monacoInstance.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions: async (model, position, context, token) => {
        const { inlineCompletionsEnabled, disabledInlineLanguages } = useUIStore.getState();

        if (!inlineCompletionsEnabled || disabledInlineLanguages.includes(language)) {
          return { items: [] };
        }

        const offset = model.getOffsetAt(position);
        const textBeforeCursor = model.getValue().slice(0, offset);

        // --- 1. Client-Side Cache Check (Sticky Ghost Text) ---
        // If the user typed something that matches the beginning of the previous suggestion,
        // we can just "reveal" more of the hidden suggestion without an API call.
        if (cacheRef.current && textBeforeCursor.startsWith(cacheRef.current.prefix)) {
            // "delta" is what the user typed since the suggestion was fetched
            const delta = textBeforeCursor.slice(cacheRef.current.prefix.length);
            
            // Check if the old suggestion text actually starts with what the user typed
            if (cacheRef.current.suggestion.startsWith(delta)) {
                // Return the *remaining* part of the suggestion
                const remaining = cacheRef.current.suggestion.slice(delta.length);
                if (remaining) {
                    return {
                        items: [{
                            insertText: remaining,
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: position.column,
                                endLineNumber: position.lineNumber,
                                endColumn: position.column,
                            },
                        }],
                        enableForwardStability: true,
                        suppressSuggestions: true,
                    };
                }
            }
        }

        // --- 2. Cancel previous inflight request ---
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        // --- 3. Setup new request ---
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Wrap fetch in a Promise to wait for idle time if needed
        return new Promise((resolve) => {
            const work = async () => {
                if (token.isCancellationRequested || abortController.signal.aborted) {
                    resolve({ items: [] });
                    return;
                }

                const code = model.getValue();
                
                try {
                    const suggestionText = await onFetchSuggestion(code, offset, abortController.signal);
                    
                    if (suggestionText && !token.isCancellationRequested && !abortController.signal.aborted) {
                        // Update cache for sticky behavior on next keystroke
                        cacheRef.current = {
                            prefix: textBeforeCursor,
                            suggestion: suggestionText
                        };

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
                  // Silent fail
                }
                
                // If failed or empty, clear cache to avoid stuck bad suggestions
                cacheRef.current = null;
                resolve({ items: [] });
            };

            // Use requestIdleCallback to avoid blocking main thread during rapid typing
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(work, { timeout: 200 });
            } else {
                setTimeout(work, 20);
            }
        });
      },
      // @ts-ignore
      disposeInlineCompletions: () => {},
    });

    return () => {
        provider.dispose();
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };
  }, [monacoInstance, editorInstance, language, onFetchSuggestion]);
};
