
import { Diagnostic, Linter } from '../types';
import { useLinterStore, availableLinters } from '../stores/linterStore';
import { errorService } from './errorService';

// Initialize a specific linter
export const initLinter = async (linter: Linter) => {
  const { linterStatuses, setLinterStatus } = useLinterStore.getState();
  
  if (linterStatuses[linter.id] === 'initializing' || linterStatuses[linter.id] === 'ready') {
    return;
  }

  if (!linter.init) {
    setLinterStatus(linter.id, 'ready');
    return;
  }

  setLinterStatus(linter.id, 'initializing');
  try {
    await linter.init();
    setLinterStatus(linter.id, 'ready');
  } catch (e: any) {
    setLinterStatus(linter.id, 'error');
    errorService.report(e, `Linter Init: ${linter.name}`, { terminal: true, severity: 'error' });
  }
};

// This is no longer called globally on startup
export const initLinters = async () => {
  console.log('On-demand linting initialization active.');
};

export const runLinting = (code: string, language: string): Diagnostic[] => {
  const { installedLinters, linterStatuses } = useLinterStore.getState();

  // Find the first installed linter that supports this language.
  const linter = availableLinters.find(l =>
    installedLinters.has(l.id) && l.supportedLanguages.includes(language)
  );

  if (linter) {
    // If linter is not ready and not currently initializing, trigger initialization
    if (!linterStatuses[linter.id]) {
        initLinter(linter);
        return [];
    }

    if (linterStatuses[linter.id] === 'ready') {
        try {
            return linter.lint(code);
        } catch (e: any) {
            errorService.report(e, `Linter: ${linter.name}`, { notifyUser: false, terminal: true, severity: 'error' });
            return [];
        }
    }
  }

  // No linter found or not ready for this language
  return [];
};
