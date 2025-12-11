
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';
import { File } from '../types';
import { getLanguage } from '../utils/fileUtils';

// Initialize in-memory filesystem
// @ts-ignore
const fs = new FS('vibecode-fs', { wipe: true });
const pfs = fs.promises;

export interface GitStatus {
    filepath: string;
    head: number;
    workdir: number;
    stage: number;
    status: 'modified' | 'added' | 'deleted' | 'unmodified' | 'absent' | '*added' | '*modified' | '*deleted';
}

export const gitService = {
  // Clear the FS manually when switching projects
  clear: async () => {
      try {
          const files = await pfs.readdir('/');
          for (const file of files) {
             if (file === '.git') continue; // isomorphic-git might struggle if we nuke .git while active, but we should usually be fine as we re-clone
             try {
                // Determine if dir or file
                const stat = await pfs.stat(`/${file}`);
                if (stat.isDirectory()) {
                    // Recursive delete helper (naive)
                    await gitService.deleteRecursive(`/${file}`);
                } else {
                    await pfs.unlink(`/${file}`);
                }
             } catch (e) {
                 console.warn("Failed to delete", file, e);
             }
          }
          // Try to remove .git last
          try {
              await gitService.deleteRecursive('/.git');
          } catch(e) {}
      } catch (e) {
          // ignore
      }
  },

  deleteRecursive: async (path: string) => {
      try {
          const files = await pfs.readdir(path);
          for (const file of files) {
              const curPath = `${path}/${file}`;
              const stat = await pfs.stat(curPath);
              if (stat.isDirectory()) {
                  await gitService.deleteRecursive(curPath);
              } else {
                  await pfs.unlink(curPath);
              }
          }
          await pfs.rmdir(path);
      } catch(e) {}
  },

  init: async () => {
    try {
        await git.init({ fs, dir: '/' });
    } catch (e) {
        console.error("Git Init Error", e);
    }
  },

  clone: async (url: string, proxy: string = 'https://cors.isomorphic-git.org') => {
      await git.clone({
          fs,
          http,
          dir: '/',
          url,
          corsProxy: proxy,
          singleBranch: true,
          depth: 1
      });
  },

  writeFile: async (filepath: string, content: string) => {
    try {
        // Ensure directories exist
        const parts = filepath.split('/');
        if (parts.length > 1) {
           const dir = parts.slice(0, -1).join('/');
           // Fixed: 'recursive' option is not in the type definition for lightning-fs mkdir but is supported at runtime
           // @ts-ignore
           await pfs.mkdir(`/${dir}`, { recursive: true });
        }
        await pfs.writeFile(`/${filepath}`, content, 'utf8');
    } catch (e) {
        console.error("Git Write Error", e);
    }
  },

  deleteFile: async (filepath: string) => {
    try {
        await pfs.unlink(`/${filepath}`);
    } catch (e) {
        // Ignore if file doesn't exist in fs
    }
  },

  status: async (): Promise<GitStatus[]> => {
    try {
        const matrix = await git.statusMatrix({ fs, dir: '/' });
        return matrix.map(row => {
            const [filepath, head, workdir, stage] = row;
            let status: GitStatus['status'] = 'unmodified';

            // Simplified mapping for UI
            if (head === 0 && workdir === 2 && stage === 0) status = 'added'; // Untracked
            else if (head === 0 && stage === 2) status = '*added'; // Staged New
            else if (head === 1 && workdir === 2 && stage === 1) status = 'modified'; // Modified
            else if (head === 1 && stage === 2 && workdir === 2) status = '*modified'; // Staged Modified
            else if (head === 1 && workdir === 0) status = 'deleted'; // Deleted locally
            else if (head === 1 && stage === 3) status = '*deleted'; // Staged Deletion
            else if (head === 1 && workdir === 2 && stage === 3) status = '*modified'; // Staged modified (special case)
            
            return {
                filepath,
                head,
                workdir,
                stage,
                status
            };
        });
    } catch (e) {
        console.error("Git Status Error", e);
        return [];
    }
  },

  add: async (filepath: string) => {
    await git.add({ fs, dir: '/', filepath });
  },

  remove: async (filepath: string) => {
    await git.remove({ fs, dir: '/', filepath });
  },

  reset: async (filepath: string) => {
    // Reset index (unstage)
    await git.resetIndex({ fs, dir: '/', filepath });
  },

  commit: async (message: string, name: string = 'Vibe Coder', email: string = 'coder@vibecode.ai') => {
    return git.commit({ fs, dir: '/', message, author: { name, email } });
  },

  log: async () => {
    try {
        return await git.log({ fs, dir: '/' });
    } catch (e) {
        return [];
    }
  },

  pull: async (name: string = 'Vibe Coder', email: string = 'coder@vibecode.ai') => {
    // Attempt to pull from 'main', fallback to 'master'
    try {
      await git.pull({ fs, http, dir: '/', ref: 'main', singleBranch: true, author: { name, email } });
    } catch (e: any) {
      if (e.code === 'ResolveRefError') {
        console.warn("Could not find 'main' branch, trying 'master'.");
        await git.pull({ fs, http, dir: '/', ref: 'master', singleBranch: true, author: { name, email } });
      } else {
        throw e;
      }
    }
  },

  fetch: async () => {
    // Attempt to fetch from 'main', fallback to 'master'
    try {
      return await git.fetch({ fs, http, dir: '/', ref: 'main', singleBranch: true });
    } catch (e: any) {
        if (e.code === 'ResolveRefError') {
            console.warn("Could not find 'main' branch, trying 'master'.");
            return await git.fetch({ fs, http, dir: '/', ref: 'master', singleBranch: true });
        } else {
            throw e;
        }
    }
  },

  // Helper to traverse FS and build File[] state
  loadFilesToMemory: async (): Promise<File[]> => {
      const files: File[] = [];
      
      const walk = async (dir: string, parentId: string | null) => {
          const entries = await pfs.readdir(dir);
          for (const entry of entries) {
              if (entry === '.git') continue;
              const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
              const stat = await pfs.stat(fullPath);
              const id = Math.random().toString(36).slice(2, 11);

              if (stat.isDirectory()) {
                   // Create folder node
                   files.push({
                       id,
                       name: entry,
                       type: 'folder',
                       parentId,
                       isOpen: false,
                       language: '',
                       content: ''
                   });
                   await walk(fullPath, id);
              } else {
                   // Read file content (skip binary/large files)
                   let content = '';
                   if (stat.size < 2000000) { // 2MB limit
                       content = await pfs.readFile(fullPath, 'utf8');
                   } else {
                       content = '[File too large]';
                   }
                   
                   files.push({
                       id,
                       name: entry,
                       type: 'file',
                       parentId,
                       language: getLanguage(entry),
                       content,
                       committedContent: content, // Since we just loaded from git/fs
                       isModified: false,
                       history: { past: [], future: [], lastSaved: Date.now() }
                   });
              }
          }
      };

      await walk('/', null);
      return files;
  }
};