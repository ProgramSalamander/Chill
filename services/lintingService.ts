import { Diagnostic } from '../types';
import { useLinterStore, availableLinters } from '../stores/linterStore';
import { useTerminalStore } from '../stores/terminalStore';

// Initialize all available linters that have an init function
export const initLinters = async () => {
  const initPromises = availableLinters
    .filter(linter => typeof linter.init === 'function')
    .map(linter => linter.init!());

  await Promise.all(initPromises);
  console.log('All available linters initialized.');
};

export const runLinting = (code: string, language: string): Diagnostic[] => {
  const { installedLinters } = useLinterStore.getState();

  // Find the first installed linter that supports this language.
  // In a more complex system, we might allow multiple linters per language.
  const linter = availableLinters.find(l =>
    installedLinters.has(l.id) && l.supportedLanguages.includes(language)
  );

  if (linter) {
    try {
      return linter.lint(code);
    } catch (e: any) {
      console.error(`Error running linter '${linter.name}':`, e);
      useTerminalStore.getState().addTerminalLine(`Linter '${linter.name}' failed: ${e.message}`, 'error');
      return [];
    }
  }

  // No linter found for this language
  return [];
};