
import { File } from '../types';

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

// Recursively read directory handle
export const processDirectoryHandle = async (dirHandle: any, parentId: string | null = null): Promise<File[]> => {
  let entries: File[] = [];
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
      const id = Math.random().toString(36).slice(2, 11);
      
      if (entry.kind === 'file') {
          // Filter out annoying system files
          if (['.DS_Store', 'thumbs.db'].includes(entry.name)) continue;
          
          try {
            const fileHandle = await dirHandle.getFileHandle(entry.name);
            const fileData = await fileHandle.getFile();
            
            let content = '';
            // Only read text for reasonably sized files to avoid freezing
            if (fileData.size < 5000000) { // < 5MB
                 try {
                     content = await fileData.text();
                 } catch (e) {
                     content = '[Binary or Non-Text Content]';
                 }
            } else {
                content = '[File too large to display]';
            }

            entries.push({
                id,
                name: entry.name,
                type: 'file',
                parentId,
                language: getLanguage(entry.name),
                content,
                handle: fileHandle, 
                history: { past: [], future: [], lastSaved: Date.now() }
            });
          } catch (e) {
             console.error(`Failed to read file ${entry.name}`, e);
          }

      } else if (entry.kind === 'directory') {
           // Skip heavy folders for this demo
           if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv'].includes(entry.name)) {
               entries.push({
                  id,
                  name: entry.name,
                  type: 'folder',
                  parentId,
                  isOpen: false,
                  language: '',
                  content: '',
                  handle: entry
               });
               continue;
           }
           
           const folderHandle = await dirHandle.getDirectoryHandle(entry.name);
           entries.push({
              id,
              name: entry.name,
              type: 'folder',
              parentId,
              isOpen: false,
              language: '',
              content: '',
              handle: folderHandle
           });
           
           // Recursion
           const children = await processDirectoryHandle(folderHandle, id);
           entries = [...entries, ...children];
      }
  }
  return entries;
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
