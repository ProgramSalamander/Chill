

import { File } from '../types';
import ignore from 'ignore';

// Infer language from extension
export const getLanguage = (filenameOrPath: string) => {
  const filename = filenameOrPath.split('/').pop() || '';

  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.md')) return 'markdown';

  // Treat dotfiles (e.g., .gitignore) or files with no extension as plaintext.
  if (filename.startsWith('.') || !filename.includes('.')) {
    return 'plaintext';
  }

  return 'plaintext'; // Default to plaintext for any other unknown extension.
};

// Resolve file by path string
export const resolveFileByPath = (path: string, allFiles: File[]): File | null => {
    // Trim leading/trailing slashes and split
    const pathSegments = path.replace(/^\/|\/$/g, '').split('/').filter(p => p);
    if (pathSegments.length === 0) return null;

    let currentParentId: string | null = null;
    let foundNode: File | null = null;

    for (const segment of pathSegments) {
        const node = allFiles.find(f => f.name === segment && f.parentId === currentParentId);

        if (!node) {
            return null; // Path segment not found
        }
        
        foundNode = node;
        currentParentId = node.id;
    }
    
    return foundNode;
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

export const generateProjectStructureContext = (files: File[]): string => {
  const structure = files.map(f => {
     const path = getFilePath(f, files);
     return `${f.type === 'folder' ? '[DIR]' : '[FILE]'} ${path}`;
  }).sort().join('\n');

  return `PROJECT STRUCTURE:\n${structure}`;
};

export const extractSymbols = (file: File): string => {
    const lang = getLanguage(file.name);
    const content = file.content;
    const lines = content.split('\n');
    const symbols: string[] = [];

    // Very naive regex-based symbol extraction
    if (lang === 'typescript' || lang === 'javascript') {
        const regex = /^(?:export\s+)?(?:async\s+)?(?:function\s+|class\s+|const\s+|let\s+|var\s+|interface\s+|type\s+)([a-zA-Z0-9_]+)/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            symbols.push(match[1]);
        }
    } else if (lang === 'python') {
        const regex = /^(?:def|class)\s+([a-zA-Z0-9_]+)/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            symbols.push(match[1]);
        }
    }

    if (symbols.length === 0) return "No top-level symbols found.";
    return "Symbols found:\n- " + symbols.join("\n- ");
};
