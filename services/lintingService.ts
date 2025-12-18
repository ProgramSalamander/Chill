
import { Diagnostic } from '../types';
import { useLinterStore, availableLinters } from '../stores/linterStore';
import { errorService } from './errorService';

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
  const linter = availableLinters.find(l =>
    installedLinters.has(l.id) && l.supportedLanguages.includes(language)
  );

  if (linter) {
    try {
      return linter.lint(code);
    } catch (e: any) {
      errorService.report(e, `Linter: ${linter.name}`, { notifyUser: false, terminal: true, severity: 'error' });
      return [];
    }
  }

  // No linter found for this language
  return [];
};
