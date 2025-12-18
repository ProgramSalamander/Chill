import { useTerminalStore } from '../stores/terminalStore';
import { notify } from '../stores/notificationStore';

export interface ErrorReportOptions {
  silent?: boolean;
  terminal?: boolean;
  notifyUser?: boolean;
  severity?: 'error' | 'warning' | 'info';
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
    console.error(`Chill Error: ${fullMessage}`, error);

    // 2. Terminal for in-app flow visibility
    if (terminal) {
      useTerminalStore.getState().addTerminalLine(fullMessage, severity === 'error' ? 'error' : (severity === 'warning' ? 'warning' : 'info'));
    }

    // 3. Toaster for critical user attention
    if (notifyUser && !silent && severity === 'error') {
      notify(message, 'error');
    }
    
    return message;
  }
};