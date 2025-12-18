
import { useFileTreeStore } from '../stores/fileStore';
import { useTerminalStore } from '../stores/terminalStore';
import { ragService } from './ragService';
import { generateProjectStructureContext, extractSymbols, resolveFileByPath, getFilePath, getLanguage } from '../utils/fileUtils';
import { notify } from '../stores/notificationStore';
import { File, Diagnostic } from '../types';
import { aiService } from './aiService';
import { runLinting } from './lintingService';
import { gitService } from './gitService';

/**
 * Helper function: Get the most "truthy" current content of a file.
 * If the file has a pending AI Patch, return the predicted content after the patch; 
 * otherwise, return the original content stored on disk.
 */
const getEffectiveContent = (file: File): string => {
  // This design allows the Agent to "see" its own proposed changes even if they haven't been 
  // accepted by the user yet, ensuring consistency across sequential tool calls.
  const { patches } = (window as any).__vibe_agent_store_handle || { patches: [] };
  const activePatch = patches.find((p: any) => p.fileId === file.id && p.status === 'pending');
  return activePatch ? activePatch.proposedText : file.content;
};

export const handleAgentAction = async (toolName: string, args: any): Promise<{ result: string }> => {
  const { addTerminalLine } = useTerminalStore.getState();
  const { files } = useFileTreeStore.getState();
  
  // Optimization: Dynamically fetch the store reference to avoid circular dependencies
  const agentStore = await import('../stores/agentStore').then(m => m.useAgentStore);
  const { addPatch, patches } = agentStore.getState();
  
  // Inject state handle into window so getEffectiveContent can access it without hooks
  (window as any).__vibe_agent_store_handle = agentStore.getState();

  switch (toolName) {
    case 'fs_listFiles':
      const structure = generateProjectStructureContext(files);
      return { result: `[SYSTEM] Project structure retrieved:\n${structure}` };

    case 'fs_readFile': {
      const path = args.path;
      const fileToRead = resolveFileByPath(path, files);
      if (fileToRead && fileToRead.type === 'file') {
        const content = getEffectiveContent(fileToRead);
        return { result: `[SUCCESS] File content of ${path}:\n\`\`\`${fileToRead.language}\n${content}\n\`\`\`` };
      }
      return { result: `[ERROR] Could not find file at: ${path}` };
    }

    case 'fs_writeFile': {
      const { path, content } = args;
      if (!path || content === undefined) return { result: "[ERROR] Missing 'path' or 'content'." };

      const existingFile = resolveFileByPath(path, files);
      if (existingFile && existingFile.type === 'folder') {
        return { result: `[ERROR] Path '${path}' is a directory.` };
      }

      if (existingFile) {
        // If content is already identical, skip patch generation
        if (getEffectiveContent(existingFile) === content) {
          return { result: `[INFO] File ${path} already matches the target content.` };
        }

        const lines = existingFile.content.split('\n');
        addPatch({
          fileId: existingFile.id,
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: lines.length || 1,
            endColumn: (lines[lines.length - 1]?.length || 0) + 1
          },
          originalText: existingFile.content,
          proposedText: content
        });
        return { result: `[SUCCESS] Proposed changes to ${path}. Agent will now perceive this new content.` };
      } else {
        // New file creation workflow
        const { createNode } = useFileTreeStore.getState();
        const pathSegments = path.split('/').filter(Boolean);
        const fileName = pathSegments.pop() || 'untitled.ts';
        
        let currentParentId: string | null = null;
        for (const segment of pathSegments) {
            const folder = useFileTreeStore.getState().files.find(f => f.type === 'folder' && f.name === segment && f.parentId === currentParentId);
            if (folder) {
                currentParentId = folder.id;
            } else {
                const newFolder = await createNode('folder', currentParentId, segment);
                if (newFolder) currentParentId = newFolder.id;
            }
        }
        
        const newFile = await createNode('file', currentParentId, fileName, '');
        if (newFile) {
            addPatch({
              fileId: newFile.id,
              range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
              originalText: '',
              proposedText: content
            });
            return { result: `[SUCCESS] Created new file ${path} and staged content for review.` };
        }
        return { result: `[ERROR] Failed to create ${path}.` };
      }
    }

    case 'git_getStatus': {
      const status = await gitService.status();
      const changes = status.filter(s => s.status !== 'unmodified');
      if (changes.length === 0) return { result: "Working tree is clean." };
      return { result: `Repo status:\n${changes.map(s => `${s.status}: ${s.filepath}`).join('\n')}` };
    }

    case 'git_diff': {
        const { path } = args;
        const file = resolveFileByPath(path, files);
        if (!file || file.type !== 'file') return { result: `[ERROR] File not found: ${path}` };

        const headContent = await gitService.readBlob(path).catch(() => null);
        const currentContent = getEffectiveContent(file);

        if (headContent === null) return { result: `[INFO] File ${path} is new/untracked. Content:\n${currentContent}` };
        if (headContent === currentContent) return { result: `[INFO] No differences in ${path}.` };

        // Enhancement: Return line-indexed Diff format to help the LLM process changes
        const headLines = headContent.split('\n');
        const currLines = currentContent.split('\n');
        let diff = '';
        const max = Math.max(headLines.length, currLines.length);
        for(let i=0; i<max; i++) {
            if (headLines[i] !== currLines[i]) {
                if (headLines[i] !== undefined) diff += `-${i+1}: ${headLines[i]}\n`;
                if (currLines[i] !== undefined) diff += `+${i+1}: ${currLines[i]}\n`;
            }
        }
        return { result: `Diff for ${path}:\n${diff}` };
    }

    case 'runtime_execJs': {
        const file = resolveFileByPath(args.path, files);
        if (!file || file.type !== 'file') return { result: `[ERROR] File not found: ${args.path}` };
        
        addTerminalLine(`Agent executing: ${args.path}`, 'command');
        try {
            const logs: string[] = [];
            const mockConsole = {
                log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
                error: (...args: any[]) => logs.push(`[ERR] ${args.join(' ')}`),
                warn: (...args: any[]) => logs.push(`[WARN] ${args.join(' ')}`)
            };
            
            // Execute using the predicted "effective" content
            const execute = new Function('console', getEffectiveContent(file));
            execute(mockConsole);
            
            return { result: logs.length ? `Execution Output:\n${logs.join('\n')}` : "Executed with no output." };
        } catch(e: any) {
            return { result: `[RUNTIME ERROR] ${e.message}` };
        }
    }

    case 'tooling_lint': {
        const targetFile = args.path ? resolveFileByPath(args.path, files) : null;
        const filesToLint = targetFile ? [targetFile] : files.filter(f => f.type === 'file');
        
        let report = '';
        for (const f of filesToLint) {
            if (f.type !== 'file') continue;
            // Now async await
            const diagnostics = await runLinting(getEffectiveContent(f), f.language);
            if (diagnostics.length > 0) {
                report += `\nFile: ${getFilePath(f, files)}\n` + diagnostics.map(d => `  - [${d.severity}] L${d.startLine}: ${d.message}`).join('\n');
            }
        }
        return { result: report || "No linting issues found." };
    }

    case 'searchCode': {
      const results = await ragService.search(args.query, 5);
      if (!results.length) return { result: "No semantic matches found." };
      return { result: `Search Results:\n${results.map(r => `File: ${r.filePath}\nSnippet: ${r.snippet}`).join('\n---\n')}` };
    }

    case 'autoFixErrors': {
        const path = args.path;
        const file = resolveFileByPath(path, files);
        if (!file || file.type !== 'file') return { result: `[ERROR] File not found: ${path}` };

        const currentContent = getEffectiveContent(file);
        // Now async await
        const diagnostics = await runLinting(currentContent, file.language);
        if (!diagnostics.length) return { result: `No errors to fix in ${path}.` };

        const instruction = `Fix these issues in ${path}:\n${diagnostics.map(d => d.message).join('\n')}\nReturn only the complete fixed code.`;
        try {
            const fixedCode = await aiService.editCode('', currentContent, '', instruction, file, files);
            if (fixedCode && fixedCode !== currentContent) {
                addPatch({
                  fileId: file.id,
                  range: { startLineNumber: 1, startColumn: 1, endLineNumber: currentContent.split('\n').length || 1, endColumn: 999 },
                  originalText: file.content,
                  proposedText: fixedCode
                });
                return { result: `[SUCCESS] Applied auto-fixes to ${path}.` };
            }
            return { result: "[INFO] AI suggested no changes for the fix." };
        } catch (e: any) {
            return { result: `[ERROR] Auto-fix failed: ${e.message}` };
        }
    }

    default:
      return { result: `[ERROR] Unknown tool: ${toolName}` };
  }
};
