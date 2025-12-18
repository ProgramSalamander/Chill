
import { useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { ragService } from '../../../services/ragService';

export const useSemanticAutocomplete = (
  monacoInstance: typeof monaco | null,
  editorInstance: monaco.editor.IStandaloneCodeEditor | null,
  language: string
) => {
  useEffect(() => {
    if (!monacoInstance || !editorInstance) return;

    const provider = monacoInstance.languages.registerCompletionItemProvider(language, {
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
                kind: monacoInstance.languages.CompletionItemKind.Snippet,
                insertText: r.snippet,
                documentation: `Matched Code from ${r.filePath}:\n\n${r.snippet}`,
                range: range,
                sortText: '000_' + r.score // Prioritize these
            }));

            return { suggestions };
        }
    });

    return () => provider.dispose();
  }, [monacoInstance, editorInstance, language]);
};
