
import { useEffect } from 'react';
import * as monaco from 'monaco-editor';

export const useCodeLens = (
  monacoInstance: typeof monaco | null,
  editorInstance: monaco.editor.IStandaloneCodeEditor | null,
  language: string,
  commandId: string | null,
  onAICommand?: (type: 'test' | 'docs' | 'refactor' | 'fix', context: any) => void
) => {
  useEffect(() => {
    if (!monacoInstance || !editorInstance || !commandId || !onAICommand) return;

    const provider = monacoInstance.languages.registerCodeLensProvider(language, {
        provideCodeLenses: (model) => {
            const lenses = [];
            const content = model.getValue();
            
            // Regex to find functions and classes
            const regex = /(?:export\s+)?(?:async\s+)?(?:function\s+([a-zA-Z0-9_]+)|class\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)/g;
            
            let match;
            while ((match = regex.exec(content)) !== null) {
                const startPos = model.getPositionAt(match.index);
                const endPos = model.getPositionAt(match.index + match[0].length);
                const range = {
                    startLineNumber: startPos.lineNumber,
                    startColumn: startPos.column,
                    endLineNumber: endPos.lineNumber,
                    endColumn: endPos.column
                };

                // Helper to create the argument callback
                const createArg = (type: 'test' | 'docs' | 'refactor') => {
                    return () => onAICommand(type, { range, code: match![0] });
                };

                // Generate Test
                lenses.push({
                    range,
                    id: "test",
                    command: {
                        id: commandId,
                        title: "$(beaker) Generate Test",
                        arguments: [createArg('test')]
                    }
                });

                // Add Docs
                lenses.push({
                    range,
                    id: "docs",
                    command: {
                        id: commandId,
                        title: "$(book) Add Docs",
                        arguments: [createArg('docs')]
                    }
                });

                // Refactor
                lenses.push({
                    range,
                    id: "refactor",
                    command: {
                        id: commandId,
                        title: "$(wand) Refactor",
                        arguments: [createArg('refactor')]
                    }
                });
            }
            return { lenses, dispose: () => {} };
        }
    });

    return () => provider.dispose();
  }, [monacoInstance, editorInstance, language, commandId, onAICommand]);
};
