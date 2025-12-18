
import { PYTHON_WORKER_CODE } from './pythonWorkerCode';
import { useTerminalStore } from '../stores/terminalStore';
import { useFileTreeStore } from '../stores/fileStore';
import { getFilePath } from '../utils/fileUtils';

class ExecutionService {
  private pyWorker: Worker | null = null;
  private isPyReady: boolean = false;

  private initPyWorker() {
    if (this.pyWorker) return;

    try {
        const blob = new Blob([PYTHON_WORKER_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.pyWorker = new Worker(url);

        this.pyWorker.onmessage = (e) => {
            const { type, content, id } = e.data;
            const { addTerminalLine } = useTerminalStore.getState();

            if (type === 'ready') {
                this.isPyReady = true;
                addTerminalLine('Python Runtime Ready', 'success');
            } else if (type === 'stdout') {
                addTerminalLine(content, 'info');
            } else if (type === 'stderr') {
                addTerminalLine(content, 'error');
            } else if (type === 'result') {
                if (content) addTerminalLine(`Result: ${content}`, 'success');
            } else if (type === 'error') {
                addTerminalLine(content, 'error');
            }
        };
        
        useTerminalStore.getState().addTerminalLine('Initializing Python Runtime...', 'info');
    } catch (e) {
        console.error("Failed to init python worker", e);
    }
  }

  public async runCode(code: string, language: string) {
    const { addTerminalLine } = useTerminalStore.getState();

    if (language === 'python') {
        if (!this.pyWorker) this.initPyWorker();
        
        // Prepare file system map for the worker with FULL PATHS
        const files = useFileTreeStore.getState().files;
        const fileMap: Record<string, string> = {};
        files.forEach(f => {
            if (f.type === 'file') {
                const path = getFilePath(f, files);
                fileMap[path] = f.content;
            }
        });

        addTerminalLine('Running Python script...', 'command');
        this.pyWorker?.postMessage({
            type: 'run',
            id: Date.now().toString(),
            code,
            files: fileMap
        });
    } else if (language === 'javascript') {
        addTerminalLine('Running JavaScript...', 'command');
        try {
            // Basic secure-ish eval for JS
            const logs: string[] = [];
            const mockConsole = {
                log: (...args: any[]) => {
                    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
                    logs.push(msg);
                    addTerminalLine(msg, 'info');
                },
                error: (...args: any[]) => {
                    const msg = args.join(' ');
                    logs.push(msg);
                    addTerminalLine(msg, 'error');
                },
                warn: (...args: any[]) => {
                    const msg = args.join(' ');
                    logs.push(msg);
                    addTerminalLine(msg, 'warning');
                }
            };
            
            const run = new Function('console', code);
            run(mockConsole);
        } catch (e: any) {
            addTerminalLine(e.toString(), 'error');
        }
    } else {
        addTerminalLine(`Execution not supported for ${language}`, 'warning');
    }
  }
}

export const executionService = new ExecutionService();
