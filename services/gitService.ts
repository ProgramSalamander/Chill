
import git from 'isomorphic-git';
import FS from '@isomorphic-git/lightning-fs';

// Initialize in-memory filesystem
// @ts-ignore
const fs = new FS('vibecode-fs', { wipe: true });

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
      // lightning-fs doesn't have a simple "clear all" public API readily available on the instance 
      // without re-creating it or recursively deleting. 
      // Re-initialization with wipe: true is usually done at import time.
      // For runtime clearing, we can try to unlink root items.
      try {
          const files = await fs.promises.readdir('/');
          for (const file of files) {
             const stat = await fs.promises.stat(`/${file}`);
             if (stat.isDirectory()) {
                 // recursive delete is not standard in this fs promises API, assume we rely on app logic to not mix projects
             } else {
                 await fs.promises.unlink(`/${file}`);
             }
          }
      } catch (e) {
          // ignore
      }
  },

  init: async () => {
    try {
        await git.init({ fs, dir: '/' });
    } catch (e) {
        console.error("Git Init Error", e);
    }
  },

  writeFile: async (filepath: string, content: string) => {
    try {
        // Ensure directories exist
        const parts = filepath.split('/');
        if (parts.length > 1) {
           const dir = parts.slice(0, -1).join('/');
           // Fixed: 'recursive' option is not in the type definition for lightning-fs mkdir but is supported at runtime
           // @ts-ignore
           await fs.promises.mkdir(`/${dir}`, { recursive: true });
        }
        await fs.promises.writeFile(`/${filepath}`, content, 'utf8');
    } catch (e) {
        console.error("Git Write Error", e);
    }
  },

  deleteFile: async (filepath: string) => {
    try {
        await fs.promises.unlink(`/${filepath}`);
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
  }
};
