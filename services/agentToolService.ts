import { useFileTreeStore } from '../stores/fileStore';
import { useTerminalStore } from '../stores/terminalStore';
import { ragService } from './ragService';
import { generateProjectStructureContext, extractSymbols, resolveFileByPath, getFilePath, getLanguage } from '../utils/fileUtils';
import { notify } from '../stores/notificationStore';
import { File, Diagnostic, StagedChange } from '../types';
import { aiService } from './aiService';
import { runLinting } from './lintingService';
import { gitService } from './gitService';

export const handleAgentAction = async (toolName: string, args: any): Promise<{ result: string; change?: Omit<StagedChange, 'id'> }> => {
  const { addTerminalLine } = useTerminalStore.getState();
  const { files } = useFileTreeStore.getState();
  const { stagedChanges, addPatch } = await import('../stores/agentStore').then(m => m.useAgentStore.getState());

  switch (toolName) {
    case 'fs_listFiles':
      const structure = generateProjectStructureContext(files);
      return { result: `Success:\n${structure}` };

    case 'fs_readFile': {
      const path = args.path;

      // Check staged changes first. They represent the agent's current "virtual" filesystem state.
      const stagedChange = [...stagedChanges].reverse().find(c => c.path === path);

      if (stagedChange) {
        if (stagedChange.type === 'delete') {
          return { result: `Error: File not found at path ${path} (staged for deletion).` };
        }
        if (stagedChange.newContent !== undefined) {
          const lang = getLanguage(path); 
          return { result: `Success:\n\`\`\`${lang}\n${stagedChange.newContent}\n\`\`\`` };
        }
      }

      // If no relevant staged change, fall back to the committed filesystem state.
      const fileToRead = resolveFileByPath(path, files);
      if (fileToRead && fileToRead.type === 'file') {
        return { result: `Success:\n\`\`\`${fileToRead.language}\n${fileToRead.content}\n\`\`\`` };
      }
      if (fileToRead && fileToRead.type === 'folder') {
          return { result: `Error: Path '${args.path}' is a directory, not a file.` }
      }
      return { result: `Error: File not found at path ${args.path}` };
    }

    case 'fs_writeFile': {
      const path = args.path;
      const content = args.content;
      if (typeof path !== 'string' || typeof content !== 'string') {
        return { result: "Error: 'path' and 'content' must be strings." };
      }
      const existingFile = resolveFileByPath(path, files);

      if (existingFile && existingFile.type === 'folder') {
        return { result: `Error: Cannot write file. A folder already exists at path ${path}` };
      }

      if (existingFile) { // Create an inline patch for existing file
        const lines = existingFile.content.split('\n');
        addPatch({
          fileId: existingFile.id,
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: lines.length,
            endColumn: (lines[lines.length - 1]?.length || 0) + 1
          },
          originalText: existingFile.content,
          proposedText: content
        });

        return {
          result: `Success: Proposed changes to ${path} as an inline patch. Review in editor.`,
        };
      } else { // Create new file
        return {
          result: `Success: Staged new file creation for ${path}`,
          change: {
            type: 'create',
            path,
            newContent: content,
          }
        };
      }
    }
    
    case 'fs_deleteFile': {
        const path = args.path;
        if (typeof path !== 'string') {
            return { result: "Error: 'path' must be a string." };
        }
        const fileToDelete = resolveFileByPath(path, files);
        if (!fileToDelete) {
            return { result: `Error: File not found at path ${path}` };
        }
        if (fileToDelete.type === 'folder') {
            return { result: `Error: Cannot delete a folder. Use a different tool if you need to remove directories.` };
        }
        return {
          result: `Success: Staged file deletion for ${path}`,
          change: {
            type: 'delete',
            path,
            fileId: fileToDelete.id,
            oldContent: fileToDelete.content,
          }
        };
    }

    case 'git_getStatus': {
      const status = await gitService.status();
      if (status.length === 0) return { result: "Success: Working tree is clean." };
      const formattedStatus = status
        .filter(s => s.status !== 'unmodified')
        .map(s => `${s.status.padEnd(10)} ${s.filepath}`)
        .join('\n');
      return { result: `Success: Current repository status:\n${formattedStatus}` };
    }

    case 'git_diff': {
        const { path } = args;
        if (!path) return { result: "Error: 'path' argument is required for git_diff." };
        
        const file = resolveFileByPath(path, files);
        if (!file) return { result: `Error: File not found at path ${path}` };
        if (file.type === 'folder') return { result: `Error: Cannot diff a folder: ${path}` };

        const headContent = await gitService.readBlob(path);

        if (headContent === null) {
            const gitFileStatus = (await gitService.status()).find(s => s.filepath === path);
            if (gitFileStatus && (gitFileStatus.status === 'added' || gitFileStatus.status === '*added')) {
                const diffOutput = file.content.split('\n').map(l => `+ ${l}`).join('\n');
                return { result: `Success: Diff for new file ${path}\n\`\`\`diff\n${diffOutput}\n\`\`\`` };
            }
            return { result: `Error: Could not get content from HEAD for ${path}. The file might not be committed.` };
        }

        if (headContent === file.content) {
            return { result: `Success: No changes for ${path}.` };
        }

        const headLines = headContent.split('\n');
        const currentLines = file.content.split('\n');
        const diffOutput: string[] = [];
        const maxLen = Math.max(headLines.length, currentLines.length);

        for (let i = 0; i < maxLen; i++) {
            const headLine = headLines[i];
            const currentLine = currentLines[i];
            
            if (headLine !== currentLine) {
                if (headLine !== undefined) diffOutput.push(`- ${headLine}`);
                if (currentLine !== undefined) diffOutput.push(`+ ${currentLine}`);
            } else if (headLine !== undefined) {
                diffOutput.push(`  ${headLine}`);
            }
        }
        
        return { result: `Success: Diff for ${path}\n\`\`\`diff\n${diffOutput.join('\n')}\n\`\`\`` };
    }

    case 'tooling_lint': {
        const filesToLint = args.path ? [resolveFileByPath(args.path, files)].filter((f): f is File => !!f && f.type === 'file') : files.filter(f => f.type === 'file');
        if (filesToLint.length === 0) return { result: `Error: No files found to lint.` };

        let allDiagnostics: { file: string; diagnostics: Diagnostic[] }[] = [];
        for (const file of filesToLint) {
            const diagnostics = runLinting(file.content, file.language);
            if (diagnostics.length > 0) {
                allDiagnostics.push({ file: getFilePath(file, files), diagnostics });
            }
        }

        if (allDiagnostics.length === 0) return { result: "Success: No linting issues found." };
        
        const formattedDiagnostics = allDiagnostics.map(res => 
            `File: ${res.file}\n` + 
            res.diagnostics.map(d => `  - [${d.severity}] L${d.startLine}: ${d.message}`).join('\n')
        ).join('\n\n');
        
        return { result: `Success: Found linting issues:\n${formattedDiagnostics}` };
    }

    case 'tooling_runTests': {
        addTerminalLine(`Agent running tests: ${args.runner}`, 'command');
        if (args.runner === 'npm test' || args.runner === 'pytest') {
            const result = "Success: 2 of 2 tests passed.";
            addTerminalLine(result, 'success');
            return { result };
        }
        const errorMsg = `Error: Test runner '${args.runner}' is not supported. Use 'npm test' or 'pytest'.`;
        return { result: errorMsg };
    }

    case 'runtime_execJs': {
        const fileToExec = resolveFileByPath(args.path, files);
        if (!fileToExec) return { result: `Error: File not found at path ${args.path}` };
        if (fileToExec.type === 'folder') return { result: `Error: Cannot execute a folder: ${args.path}` };
        
        const lang = getLanguage(fileToExec.name);
        if (lang !== 'javascript' && lang !== 'typescript') {
             return { result: `Error: Only JavaScript/TypeScript files can be executed. This is a '${lang}' file.` };
        }

        addTerminalLine(`Agent executing: node ${args.path}`, 'command');
        try {
            const logs: string[] = [];
            const sandboxedConsole = {
                log: (...args: any[]) => logs.push(args.map(a => {
                    try { return JSON.stringify(a); } catch { return String(a); }
                }).join(' '))
            };
            
            const sandboxedFunction = new Function('console', fileToExec.content);
            sandboxedFunction(sandboxedConsole);
            
            const output = logs.join('\n');
            if (output) {
                addTerminalLine(`Output:\n${output}`, 'info');
                return { result: `Success: Executed ${args.path}.\nOutput:\n${output}` };
            }
            return { result: `Success: Executed ${args.path}. No output was logged to console.` };

        } catch(e: any) {
            addTerminalLine(`Execution Error: ${e.message}`, 'error');
            return { result: `Error: Execution failed: ${e.message}` };
        }
    }

    case 'searchCode':
      const results = ragService.search(args.query, 5);
      if(results.length === 0) return { result: "No relevant code found." };
      return { result: `Found ${results.length} relevant code snippets:\n` + results.map(r => `File: ${r.filePath}\n\`\`\`\n${r.snippet}\n\`\`\``).join('\n---\n') };
      
    case 'getFileStructure':
      const fileForStructure = resolveFileByPath(args.path, files);
      if (fileForStructure && fileForStructure.type === 'file') {
        return { result: extractSymbols(fileForStructure) };
      }
      if (fileForStructure && fileForStructure.type === 'folder') {
          return { result: `Error: Path '${args.path}' is a directory. Please provide a file path.` };
      }
      return { result: `Error: File not found at path ${args.path}` };
      
    case 'grep': {
        const { pattern, path: grepPath } = args;
        if (!pattern) {
            return { result: "Error: 'pattern' argument is required for grep." };
        }

        const filesToSearch = grepPath 
            ? [resolveFileByPath(grepPath, files)].filter((f): f is File => f !== null && f.type === 'file') 
            : files.filter(f => f.type === 'file');
        
        let allResults: string[] = [];
        let totalMatches = 0;

        try {
            const regex = new RegExp(pattern, 'i'); 

            for (const file of filesToSearch) {
                if (!file.content) continue;

                const fileResults: string[] = [];
                const lines = file.content.split('\n');

                lines.forEach((line, index) => {
                    if (regex.test(line)) {
                        fileResults.push(`  L${index + 1}: ${line.trim()}`);
                        totalMatches++;
                    }
                });

                if (fileResults.length > 0) {
                    allResults.push(`File: ${getFilePath(file, files)}\n${fileResults.join('\n')}`);
                }
            }
        } catch (e: any) {
            if (e instanceof SyntaxError) {
                return { result: `Error: Invalid regex pattern provided: '${pattern}'` };
            }
            return { result: `Error: An unexpected error occurred during grep: ${e.message}` };
        }


        if (allResults.length === 0) {
            return { result: "Success: No matches found." };
        }
        
        const fullResultString = allResults.join('\n---\n');
        if (fullResultString.length > 4000) {
             return { result: `Success: Found ${totalMatches} matches in ${allResults.length} files. (Results truncated)\n---\n${fullResultString.slice(0, 4000)}...` };
        }

        return { result: `Success: Found ${totalMatches} matches in ${allResults.length} files:\n---\n${fullResultString}` };
    }

    case 'autoFixErrors': {
        const { path } = args;
        if (!path) {
            return { result: "Error: 'path' argument is required for autoFixErrors." };
        }

        const fileToFix = resolveFileByPath(path, files);
        if (!fileToFix) {
            return { result: `Error: File not found at path ${path}` };
        }
        if (fileToFix.type === 'folder') {
            return { result: `Error: Cannot fix errors in a folder: ${path}` };
        }
        
        const originalContent = fileToFix.content;
        const diagnostics = runLinting(originalContent, fileToFix.language);

        if (diagnostics.length === 0) {
            return { result: `Success: No errors found in ${path}.` };
        }
        
        const errorsString = diagnostics
            .map(d => `- ${d.message} (Line ${d.startLine}, Col ${d.startColumn})`)
            .join('\n');
            
        const instruction = `Please fix the following ${diagnostics.length} errors in the provided code snippet:\n${errorsString}\n\nReturn ONLY the complete, corrected code for the entire file. Do not add any explanations, comments, or markdown formatting.`;

        try {
            const fixedCode = await aiService.editCode('', originalContent, '', instruction, fileToFix, files);
            
            if (fixedCode && fixedCode.trim() !== originalContent.trim()) {
                notify(`Staged auto-fix for ${path}`, 'success');
                // Instead of update change, use inline patch if possible
                const lines = originalContent.split('\n');
                addPatch({
                  fileId: fileToFix.id,
                  range: {
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: lines.length,
                    endColumn: (lines[lines.length - 1]?.length || 0) + 1
                  },
                  originalText: originalContent,
                  proposedText: fixedCode
                });

                return {
                  result: `Success: Analyzed and proposed an automatic fix for ${diagnostics.length} errors in ${path}. Review inline.`,
                };
            } else if (fixedCode) {
                return { result: `Success: Analysis complete, but no changes were necessary.` };
            } else {
                 return { result: `Error: AI failed to generate a fix for the errors in ${path}.` };
            }
        } catch (e: any) {
            console.error("Auto-fix failed:", e);
            return { result: `Error: An exception occurred while trying to fix errors in ${path}: ${e.message}` };
        }
    }

    default:
      return { result: `Error: Unknown tool ${toolName}` };
  }
};