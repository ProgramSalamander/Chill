
import { Diagnostic } from '../types';
import { useLinterStore } from '../stores/linterStore';
import { errorService } from './errorService';
import { LINT_WORKER_CODE } from './lintWorkerCode';

class LintingService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (d: Diagnostic[]) => void }>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      const blob = new Blob([LINT_WORKER_CODE], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      // Fix: Worker must be type 'module' to support ES imports inside the worker code
      this.worker = new Worker(workerUrl, { type: 'module' });

      this.worker.onmessage = (e) => {
        const { id, diagnostics, error } = e.data;
        if (this.pendingRequests.has(id)) {
          const { resolve } = this.pendingRequests.get(id)!;
          if (error) {
             console.error("Lint Worker Error:", error);
             resolve([]); 
          } else {
             resolve(diagnostics || []);
          }
          this.pendingRequests.delete(id);
        }
      };

      this.worker.onerror = (e) => {
        console.error("Lint Worker Critical Error", e);
      };
    } catch (e) {
      errorService.report(e, "Lint Worker Init", { silent: true });
    }
  }

  public runLinting(code: string, language: string): Promise<Diagnostic[]> {
    if (!this.worker) return Promise.resolve([]);

    const { installedLinters } = useLinterStore.getState();
    const id = Math.random().toString(36).slice(2);

    return new Promise((resolve) => {
      // Timeout fallback
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            resolve([]);
        }
      }, 5000);

      this.pendingRequests.set(id, { 
          resolve: (d) => {
              clearTimeout(timeout);
              resolve(d);
          } 
      });

      this.worker!.postMessage({ 
          id, 
          code, 
          language, 
          activeLinters: Array.from(installedLinters) 
      });
    });
  }
}

export const lintingService = new LintingService();

// Export as standalone function for backward compatibility / ease of use
export const runLinting = (code: string, language: string) => lintingService.runLinting(code, language);

export const initLinters = async () => {
    // No-op, managed by worker internally
};
