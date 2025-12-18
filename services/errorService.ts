import { useTerminalStore } from '../stores/terminalStore';
import { notify } from '../stores/notificationStore';
import { TerminalLine } from '../types';

export interface ErrorReportOptions {
  silent?: boolean;
  terminal?: boolean;
  notifyUser?: boolean;
  severity?: 'error' | 'warning' | 'info' | 'success';
}

/**
 * Centralized error reporting service for the Vibe IDE.
 * Unifies console logging, terminal output, and user notifications.
 */
export const errorService = {
  report: (error: any, context?: string, options: ErrorReportOptions = {}) => {
    const { 
      silent = false, 
      terminal = true, 
      notifyUser = true,
      severity = 'error' 
    } = options;

    // Extract human-readable message
    let message = 'An unknown error occurred';
    if (typeof error === 'string') {
      message = error;
    } else if (error instanceof Error) {
      message = error.message;
    } else if (error && typeof error === 'object' && error.message) {
      message = error.message;
    }

    const logPrefix = context ? `[${context}] ` : '';
    const fullMessage = `${logPrefix}${message}`;

    // 1. Console for developer debugging
    // Use appropriate console method based on severity
    if (severity === 'error') {
      console.error(`[Vibe Error] ${fullMessage}`, error);
    } else if (severity === 'warning') {
      console.warn(`[Vibe Warning] ${fullMessage}`);
    } else if (severity === 'success') {
      console.log(`[Vibe Success] ${fullMessage}`);
    } else {
      console.info(`[Vibe] ${fullMessage}`);
    }

    // 2. Terminal for in-app flow visibility
    if (terminal) {
      // Map severity to terminal line type. Default to info if not explicitly handled.
      const terminalType: TerminalLine['type'] = 
        severity === 'error' ? 'error' : 
        severity === 'warning' ? 'warning' : 
        severity === 'success' ? 'success' : 'info';

      useTerminalStore.getState().addTerminalLine(fullMessage, terminalType);
    }

    // 3. Toaster for critical user attention
    if (notifyUser && !silent && severity === 'error') {
      notify(message, 'error');
    }
    
    return message;
  }
};
