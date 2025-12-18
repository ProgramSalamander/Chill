import { File } from '../types';
import { getFilePath, generateProjectStructureContext } from '../utils/fileUtils';
import { useUIStore } from '../stores/uiStore';
import { errorService } from './errorService';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do',
  'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
  'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she', 'should',
  'so', 'some', 'such', 't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'return', 'const', 'let', 'var', 'function', 'import', 'export', 'from', 'div',
  'class', 'className', 'interface', 'type', 'public', 'private', 'protected', 'static', 'async', 'await',
  'new', 'this', 'super', 'extends', 'implements', 'while', 'for', 'switch', 'case', 'default', 'try', 'catch'
]);

interface Chunk {
  id: string;
  filePath: string;
  fileId: string;
  content: string;
  startLine: number;
  endLine: number;
}

interface TFIDFIndex {
  chunks: Chunk[];
  vocabulary: string[];
  idf: Map<string, number>;
  chunkVectors: Map<string, Map<string, number>>;
}

export interface SearchResult {
    fileId: string;
    filePath: string;
    score: number;
    snippet: string;
    startLine: number;
    endLine: number;
}

class RAGService {
  private index: TFIDFIndex | null = null;
  public isIndexing: boolean = false;
  private debounceIndexRef: ReturnType<typeof setTimeout> | null = null;

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-zA-Z0-9_]+/)
      .filter(token => token.length > 1 && !STOP_WORDS.has(token));
  }

  private chunkFile(file: File, allFiles: File[]): Chunk[] {
    const CHUNK_SIZE = 20; 
    const CHUNK_OVERLAP = 5; 
    const chunks: Chunk[] = [];
    const lines = file.content.split('\n');
    const filePath = getFilePath(file, allFiles);

    for (let i = 0; i < lines.length; i += (CHUNK_SIZE - CHUNK_OVERLAP)) {
      const end = Math.min(i + CHUNK_SIZE, lines.length);
      const content = lines.slice(i, end).join('\n');
      if (content.trim().length > 0) {
        chunks.push({
          id: `${file.id}-${i}`,
          filePath,
          fileId: file.id,
          content,
          startLine: i + 1,
          endLine: end,
        });
      }
    }
    return chunks;
  }

  async updateIndex(files: File[]): Promise<void> {
    if (this.isIndexing) return;
    this.isIndexing = true;
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const filesToIndex = files
        .filter(f => f.type === 'file' && f.content.length > 0 && f.content.length < 100000); 
        
      useUIStore.getState().setIndexingProgress({ loaded: 0, total: filesToIndex.length });

      const allChunks: Chunk[] = [];
      for(let i=0; i<filesToIndex.length; i++) {
          const file = filesToIndex[i];
          allChunks.push(...this.chunkFile(file, files));
          useUIStore.getState().setIndexingProgress({ loaded: i + 1, total: filesToIndex.length });
          if (i % 5 === 0) { 
              await new Promise(resolve => setTimeout(resolve, 10));
          }
      }
        
      if (allChunks.length === 0) {
        this.index = null;
        return;
      }
      
      const docFrequencies = new Map<string, number>();
      const vocabulary = new Set<string>();
      const chunkTermFrequencies = new Map<string, Map<string, number>>();

      for (const chunk of allChunks) {
        const tokens = this.tokenize(chunk.content);
        const termFrequencies = new Map<string, number>();
        for (const token of tokens) {
          vocabulary.add(token);
          termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1);
        }
        chunkTermFrequencies.set(chunk.id, termFrequencies);
        
        for (const uniqueToken of new Set(tokens)) {
            docFrequencies.set(uniqueToken, (docFrequencies.get(uniqueToken) || 0) + 1);
        }
      }
      
      const idf = new Map<string, number>();
      const numDocs = allChunks.length;
      for (const term of vocabulary) {
        const df = docFrequencies.get(term) || 0;
        idf.set(term, Math.log((numDocs + 1) / (df + 1)) + 1);
      }
      
      const chunkVectors = new Map<string, Map<string, number>>();
      for (const chunk of allChunks) {
        const tf = chunkTermFrequencies.get(chunk.id) || new Map();
        const vector = new Map<string, number>();
        let magnitude = 0;
        for (const [term, freq] of tf.entries()) {
          const tfidf = (freq / (tf.size || 1)) * (idf.get(term) || 0);
          vector.set(term, tfidf);
          magnitude += tfidf * tfidf;
        }
        const norm = Math.sqrt(magnitude);
        if (norm > 0) {
            for (const [term, val] of vector.entries()) {
                vector.set(term, val / norm);
            }
        }
        chunkVectors.set(chunk.id, vector);
      }

      this.index = {
        chunks: allChunks,
        vocabulary: Array.from(vocabulary),
        idf,
        chunkVectors,
      };

    } catch (e: any) {
      errorService.report(e, "RAG Indexing");
      this.index = null;
    } finally {
      useUIStore.getState().setIndexingProgress(null);
      this.isIndexing = false;
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
  
  private cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
      let dotProduct = 0;
      const [smallerVec, largerVec] = vecA.size < vecB.size ? [vecA, vecB] : [vecB, vecA];

      for (const [term, val] of smallerVec.entries()) {
          if (largerVec.has(term)) {
              dotProduct += val * (largerVec.get(term) || 0);
          }
      }
      return dotProduct; 
  }

  public search(query: string, limit: number = 5): SearchResult[] {
    if (!this.index) return [];

    const queryTokens = this.tokenize(query);
    const queryTf = new Map<string, number>();
    for (const token of queryTokens) {
        queryTf.set(token, (queryTf.get(token) || 0) + 1);
    }
    
    const queryVector = new Map<string, number>();
    let queryMagnitude = 0;
    for (const [term, freq] of queryTf.entries()) {
        const tfidf = (freq / (queryTf.size || 1)) * (this.index.idf.get(term) || 0);
        queryVector.set(term, tfidf);
        queryMagnitude += tfidf * tfidf;
    }

    const norm = Math.sqrt(queryMagnitude);
    if (norm > 0) {
        for (const [term, val] of queryVector.entries()) {
            queryVector.set(term, val / norm);
        }
    }

    const scores = this.index.chunks.map(chunk => ({
        chunk,
        score: this.cosineSimilarity(queryVector, this.index!.chunkVectors.get(chunk.id) || new Map())
    }));
    
    scores.sort((a, b) => b.score - a.score);

    return scores
        .slice(0, limit)
        .filter(s => s.score > 0.05)
        .map(s => ({
            fileId: s.chunk.fileId,
            filePath: s.chunk.filePath,
            score: s.score,
            snippet: s.chunk.content,
            startLine: s.chunk.startLine,
            endLine: s.chunk.endLine
        }));
  }

  public getContext(query: string, activeFile: File | null, allFiles: File[], topK: number = 5): string {
    if (!this.index) return generateProjectStructureContext(allFiles);

    const relevantChunks = this.search(query, topK);
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