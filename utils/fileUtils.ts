
import { File } from '../types';
import ignore from 'ignore';

// Infer language from extension
export const getLanguage = (filename: string) => {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.md')) return 'markdown';
  return 'typescript'; // Default
};

// Resolve file by path string
export const resolveFileByPath = (path: string, currentFiles: File[]) => {
  const exact = currentFiles.find(f => f.name === path || f.name === path.split('/').pop());
  if (exact) return exact;
  return null;
};

// Construct full file path from ID
export const getFilePath = (file: File, allFiles: File[]): string => {
  let path = file.name;
  let current = file;
  let depth = 0;
  while (current.parentId && depth < 10) { 
      const parent = allFiles.find(f => f.id === current.parentId);
      if (parent) {
          path = `${parent.name}/${path}`;
          current = parent;
      } else {
          break;
      }
      depth++;
  }
  return path;
};

export const generateProjectContext = (files: File[]): string => {
  const structure = files.map(f => {
     const path = getFilePath(f, files);
     return `${f.type === 'folder' ? '[DIR]' : '[FILE]'} ${path}`;
  }).sort().join('\n');

  const contents = files
     .filter(f => f.type === 'file')
     .map(f => `
// --- START OF FILE: ${getFilePath(f, files)} ---
${f.content}
// --- END OF FILE: ${getFilePath(f, files)} ---
     `).join('\n');
  
  return `PROJECT STRUCTURE:\n${structure}\n\nPROJECT FILES CONTENT:\n${contents}`;
};

export const processDirectoryHandle = async (
  dirHandle: any, 
  parentId: string | null, 
  pathPrefix: string,
  ig: any
): Promise<File[]> => {
  let files: File[] = [];
  
  for await (const entry of dirHandle.values()) {
    const fullPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
    
    // Check ignore
    if (ig && (ig.ignores(fullPath) || entry.name === '.git')) continue;

    const id = Math.random().toString(36).slice(2, 11);

    if (entry.kind === 'file') {
      const file = await entry.getFile();
      
      // Skip binary/large files check (simplified)
      if (file.size > 1024 * 1024 * 2) continue; // 2MB limit

      let content = '';
      try {
          content = await file.text();
      } catch (e) {
          console.warn(`Could not read file ${entry.name}`, e);
          continue;
      }
      
      files.push({
        id,
        name: entry.name,
        type: 'file',
        parentId,
        language: getLanguage(entry.name),
        content,
        handle: entry,
        isModified: false,
        history: { past: [], future: [], lastSaved: Date.now() }
      });
    } else if (entry.kind === 'directory') {
      const folder: File = {
        id,
        name: entry.name,
        type: 'folder',
        parentId,
        isOpen: false,
        language: '',
        content: '',
        handle: entry
      };
      
      files.push(folder);
      
      // Recursive call
      const children = await processDirectoryHandle(entry, id, fullPath, ig);
      files = [...files, ...children];
    }
  }
  
  return files;
};