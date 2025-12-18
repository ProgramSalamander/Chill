
import { File } from '../types';
import { getFilePath, generateProjectStructureContext } from '../utils/fileUtils';
import { useUIStore } from '../stores/uiStore';
import { errorService } from './errorService';
import { WORKER_CODE } from './ragWorkerCode';

export interface SearchResult {
    fileId: string;
    filePath: string;
    score: number;
    snippet: string;
    startLine: number;
    endLine: number;
}

class RAGService {
  private worker: Worker | null = null;
  private responseMap = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  public isIndexing: boolean = false;
  private debounceIndexRef: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
        // Create worker from Blob to avoid URL construction issues with import.meta.url in some envs
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);
        
        this.worker.onmessage = (e) => {
            const { id, type, payload } = e.data;
            if (type === 'progress') {
                useUIStore.getState().setIndexingProgress(payload);
            } else if (id && this.responseMap.has(id)) {
                const { resolve, reject } = this.responseMap.get(id)!;
                if (type === 'error') reject(payload);
                else resolve(payload);
                this.responseMap.delete(id);
            }
        };
        this.worker.onerror = (e) => {
            errorService.report(e.message, 'RAG Worker Error', { silent: true });
        };
    } catch (e: any) {
        errorService.report(e, 'RAG Worker Init', { silent: true });
    }
  }

  private async sendMessage(type: string, payload: any): Promise<any> {
    if (!this.worker) return null;
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
        this.responseMap.set(id, { resolve, reject });
        this.worker!.postMessage({ id, type, payload });
    });
  }

  async updateIndex(files: File[]): Promise<void> {
    if (this.isIndexing) return;
    this.isIndexing = true;
    
    try {
        await this.sendMessage('updateIndex', files);
    } catch (e: any) {
        errorService.report(e, "RAG Indexing Update");
    } finally {
        this.isIndexing = false;
        useUIStore.getState().setIndexingProgress(null);
    }
  }

  public triggerDebouncedUpdate(files: File[]): void {
    if (this.debounceIndexRef) clearTimeout(this.debounceIndexRef);

    this.debounceIndexRef = setTimeout(() => {
      if (files.length > 0) {
        const { setIndexingStatus } = useUIStore.getState();
        setIndexingStatus('indexing');
        this.updateIndex(files).then(() => {
          setIndexingStatus('ready');
          setTimeout(() => setIndexingStatus('idle'), 3000);
        });
      }
    }, 2000);
  }
  
  public async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        const results = await this.sendMessage('search', { query, limit });
        return results || [];
    } catch(e) {
        console.error("RAG Search failed", e);
        return [];
    }
  }

  public async getContext(query: string, activeFile: File | null, allFiles: File[], topK: number = 5): Promise<string> {
    const relevantChunks = await this.search(query, topK);
    const structure = generateProjectStructureContext(allFiles);
    
    let context = `${structure}\n\n`;

    if (relevantChunks.length > 0) {
        context += "Potentially relevant code snippets:\n";
        for (const chunk of relevantChunks) {
            context += `---\nFile: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n${chunk.snippet}\n`;
        }
        context += '---\n\n';
    }

    if (activeFile) {
      if (!relevantChunks.some(c => c.fileId === activeFile.id)) {
        context += `Currently active file (${getFilePath(activeFile, allFiles)}):\n${activeFile.content}\n\n`;
      }
    }
    
    return context;
  }
}

export const ragService = new RAGService();
