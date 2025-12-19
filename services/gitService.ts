
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import { File } from '../types';
import { getLanguage } from '../utils/fileUtils';
import { useGitAuthStore } from '../stores/gitAuthStore';
import { errorService } from './errorService';

let fs: LightningFS;
let pfs: any;

const ACTIVE_ID_KEY = 'vibe_active_project_id';

const initFs = (projectId: string) => {
    if (!projectId) {
        projectId = 'default-scratchpad';
    }
    // wipe: false ensures we persist the .git folder across sessions
    fs = new LightningFS(`vibecode-fs-${projectId}`, { wipe: false });
    pfs = fs.promises;
};

// Initialize FS on module load with the last active project ID
const initialProjectId = localStorage.getItem(ACTIVE_ID_KEY) || 'default-scratchpad';
initFs(initialProjectId);

async function directoryExists(dirPath: string) {
  try {
    const stats = await pfs.stat(dirPath);
    return stats.type === 'dir';
  } catch (err: any) {
    return false;
  }
}

async function ensureDirectory(filepath: string) {
    const parts = filepath.split('/').filter(Boolean);
    if (parts.length <= 1) return;
    
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
        currentPath += `/${parts[i]}`;
        if (!(await directoryExists(currentPath))) {
            try {
                await pfs.mkdir(currentPath);
            } catch (e: any) {
                if (e.code !== 'EEXIST') throw e;
            }
        }
    }
}

const onAuth = (): undefined => undefined;

const onAuthFailure = async (url: string) => {
  errorService.report(`Authentication required for ${new URL(url).hostname}.`, 'Git Auth', { severity: 'warning' });
  try {
    const { username, token } = await useGitAuthStore.getState().promptForCredentials();
    return { username, password: token }; 
  } catch (e) {
    errorService.report('Authentication cancelled.', 'Git Auth', { notifyUser: false, terminal: true, severity: 'info' });
    throw new Error('Authentication cancelled by user.');
  }
};

export interface GitStatus {
    filepath: string;
    head: number;
    workdir: number;
    stage: number;
    status: 'modified' | 'added' | 'deleted' | 'unmodified' | 'absent' | '*added' | '*modified' | '*deleted';
}

export const gitService = {
  initForProject: initFs,

  clear: async () => {
      try {
          const files = await pfs.readdir('/');
          for (const file of files) {
             if (file === '.git') continue; 
             try {
                const stat = await pfs.stat(`/${file}`);
                if (stat.type === 'dir') {
                    await gitService.deleteRecursive(`/${file}`);
                } else {
                    await pfs.unlink(`/${file}`);
                }
             } catch (e) {}
          }
      } catch (e) {}
  },

  deleteRecursive: async (path: string) => {
      try {
          const files = await pfs.readdir(path);
          for (const file of files) {
              const curPath = `${path}/${file}`;
              const stat = await pfs.stat(curPath);
              if (stat.type === 'dir') {
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
    } catch (e: any) {
        errorService.report(e, "Git Init Operation");
    }
  },

  isRepoInitialized: async (): Promise<boolean> => {
    try {
      const stats = await pfs.stat('/.git');
      return stats.type === 'dir';
    } catch (e: any) {
      return false;
    }
  },

  clone: async (url: string, proxy: string = 'https://cors.isomorphic-git.org', onProgress?: (progress: any) => void) => {
      await git.clone({
          fs,
          http,
          dir: '/',
          url,
          corsProxy: proxy,
          onProgress,
          singleBranch: true,
          onAuth,
          onAuthFailure,
      });
  },

  writeFile: async (filepath: string, content: string) => {
    try {
        await ensureDirectory(filepath);
        await pfs.writeFile(`/${filepath}`, content, 'utf8');
    } catch (e: any) {
        errorService.report(e, `Git FS Write: ${filepath}`);
    }
  },

  deleteFile: async (filepath: string) => {
    try {
        await pfs.unlink(`/${filepath}`);
    } catch (e) {}
  },

  checkout: async (filepath: string) => {
    await git.checkout({
      fs,
      dir: '/',
      filepaths: [filepath],
      force: true,
    });
  },

  status: async (): Promise<GitStatus[]> => {
    try {
        const matrix = await git.statusMatrix({ fs, dir: '/' });
        return matrix.map(row => {
            const [filepath, head, workdir, stage] = row;
            let status: GitStatus['status'] = 'unmodified';

            if (head === 0 && workdir === 2 && stage === 0) status = 'added'; 
            else if (head === 0 && stage === 2) status = '*added'; 
            else if (head === 1 && workdir === 2 && stage === 1) status = 'modified'; 
            else if (head === 1 && stage === 2 && workdir === 2) status = '*modified'; 
            else if (head === 1 && workdir === 0) status = 'deleted'; 
            else if (head === 1 && stage === 3) status = '*deleted'; 
            else if (head === 1 && workdir === 2 && stage === 3) status = '*modified'; 
            
            return { filepath, head, workdir, stage, status };
        });
    } catch (e: any) {
        errorService.report(e, "Git Status Matrix", { silent: true });
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
    await git.resetIndex({ fs, dir: '/', filepath });
  },

  commit: async (message: string, name: string = 'Vibe Coder', email: string = 'coder@vibecode.ai') => {
    return git.commit({ fs, dir: '/', message, author: { name, email } });
  },

  log: async () => {
    try {
        return await git.log({ fs, dir: '/' });
    } catch (e: any) {
        return [];
    }
  },

  readBlob: async (filepath: string, ref: string = 'HEAD'): Promise<string | null> => {
    try {
      const oid = await git.resolveRef({ fs, dir: '/', ref });
      const { blob } = await git.readBlob({ fs, dir: '/', oid, filepath });
      return new TextDecoder().decode(blob);
    } catch (e) {
      return null;
    }
  },

  pull: async (name: string = 'Vibe Coder', email: string = 'coder@vibecode.ai') => {
    try {
      await git.pull({ fs, http, dir: '/', ref: 'main', singleBranch: true, author: { name, email }, onAuth, onAuthFailure });
    } catch (e: any) {
      if (e.code === 'ResolveRefError') {
        await git.pull({ fs, http, dir: '/', ref: 'master', singleBranch: true, author: { name, email }, onAuth, onAuthFailure });
      } else {
        throw e;
      }
    }
  },

  push: async (proxy: string = 'https://cors.isomorphic-git.org') => {
    return git.push({
      fs,
      http,
      dir: '/',
      corsProxy: proxy,
      onAuth,
      onAuthFailure,
    });
  },

  fetch: async () => {
    try {
      return await git.fetch({ fs, http, dir: '/', ref: 'main', singleBranch: true, onAuth, onAuthFailure });
    } catch (e: any) {
        if (e.code === 'ResolveRefError') {
            return await git.fetch({ fs, http, dir: '/', ref: 'master', singleBranch: true, onAuth, onAuthFailure });
        } else {
            throw e;
        }
    }
  },

  loadFilesToMemory: async (): Promise<File[]> => {
      const files: File[] = [];
      const walk = async (dir: string, parentId: string | null) => {
        try {
          const entries = await pfs.readdir(dir);
          for (const entry of entries) {
              if (entry === '.git') continue;
              const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
              const stat = await pfs.stat(fullPath);
              const id = Math.random().toString(36).slice(2, 11);

              if (stat.type === 'dir') {
                   files.push({ id, name: entry, type: 'folder', parentId, isOpen: false, language: '', content: '' });
                   await walk(fullPath, id);
              } else {
                   const content = await pfs.readFile(fullPath, 'utf8');
                   files.push({
                       id, name: entry, type: 'file', parentId, language: getLanguage(entry),
                       content, committedContent: content, isModified: false,
                       history: { past: [], future: [], lastSaved: Date.now() }
                   });
              }
          }
        } catch (e: any) {}
      };
      await walk('/', null);
      return files;
  }
};
