
import { useEffect } from 'react';
import * as monaco from 'monaco-editor';

export const useQuickFix = (
  monacoInstance: typeof monaco | null,
  editorInstance: monaco.editor.IStandaloneCodeEditor | null,
  language: string,
  commandId: string | null,
  onAICommand?: (type: 'test' | 'docs' | 'refactor' | 'fix', context: any) => void
) => {
  useEffect(() => {
    if (!monacoInstance || !editorInstance || !commandId || !onAICommand) return;

    const provider = monacoInstance.languages.registerCodeActionProvider(language, {
        provideCodeActions: (model, range, context) => {
            if (context.markers.length === 0) return { actions: [], dispose: () => {} };

            const actions = context.markers.map(marker => ({
                title: `✨ Fix with Vibe AI: ${marker.message}`,
                diagnostics: [marker],
                kind: "quickfix",
                isPreferred: true,
                command: {
                    id: commandId,
                    title: "Fix with Vibe AI",
                    arguments: [() => onAICommand('fix', { error: marker.message, range: marker, code: model.getValueInRange(marker) })]
                }
            }));

            return { actions, dispose: () => {} };
        }
    });

    return () => provider.dispose();
  }, [monacoInstance, editorInstance, language, commandId, onAICommand]);
};
