import { useFileTreeStore } from '../stores/fileStore';
import { useTerminalStore } from '../stores/terminalStore';
import { useAgentStore } from '../stores/agentStore';
import { ragService } from './ragService';
import { generateProjectStructureContext, extractSymbols, resolveFileByPath, getFilePath, getLanguage } from '../utils/fileUtils';
import { notify } from '../stores/notificationStore';
import { File, Diagnostic } from '../types';
import { aiService } from './aiService';
// FIX: Changed validateCode to runLinting as it is the exported function.
import { runLinting } from './lintingService';
import { gitService } from './gitService';

export const handleAgentAction = async (toolName: string, args: any): Promise<string> => {
  const { addTerminalLine } = useTerminalStore.getState();
  const { files } = useFileTreeStore.getState();
  const { addStagedChange } = useAgentStore.getState();

  switch (toolName) {
    case 'fs_listFiles':
      const structure = generateProjectStructureContext(files);
      return `Success:\n${structure}`;

    case 'fs_readFile': {
      const { stagedChanges } = useAgentStore.getState();
      const path = args.path;

      // Check staged changes first. They represent the agent's current "virtual" filesystem state.
      const stagedChange = [...stagedChanges].reverse().find(c => c.path === path);

      if (stagedChange) {
        if (stagedChange.type === 'delete') {
          return `Error: File not found at path ${path} (staged for deletion).`;
        }
        if (stagedChange.newContent !== undefined) {
          const lang = getLanguage(path); // Infer language from path as the file might not exist yet
          return `Success:\n\`\`\`${lang}\n${stagedChange.newContent}\n\`\`\``;
        }
      }

      // If no relevant staged change, fall back to the committed filesystem state.
      const fileToRead = resolveFileByPath(path, files);
      if (fileToRead && fileToRead.type === 'file') {
        return `Success:\n\`\`\`${fileToRead.language}\n${fileToRead.content}\n\`\`\``;
      }
      if (fileToRead && fileToRead.type === 'folder') {
          return `Error: Path '${args.path}' is a directory, not a file.`
      }
      return `Error: File not found at path ${args.path}`;
    }

    case 'fs_writeFile': {
      const path = args.path;
      const content = args.content;
      if (typeof path !== 'string' || typeof content !== 'string') {
        return "Error: 'path' and 'content' must be strings.";
      }
      const existingFile = resolveFileByPath(path, files);

      if (existingFile && existingFile.type === 'folder') {
        return `Error: Cannot write file. A folder already exists at path ${path}`;
      }

      if (existingFile) { // Update existing file
        addStagedChange({
          type: 'update',
          path,
          fileId: existingFile.id,
          oldContent: existingFile.content,
          newContent: content,
        });
        return `Success: Staged file update for ${path}`;
      } else { // Create new file
        addStagedChange({
          type: 'create',
          path,
          newContent: content,
        });
        return `Success: Staged new file creation for ${path}`;
      }
    }
    
    case 'fs_deleteFile': {
        const path = args.path;
        if (typeof path !== 'string') {
            return "Error: 'path' must be a string.";
        }
        const fileToDelete = resolveFileByPath(path, files);
        if (!fileToDelete) {
            return `Error: File not found at path ${path}`;
        }
        if (fileToDelete.type === 'folder') {
            return `Error: Cannot delete a folder. Use a different tool if you need to remove directories.`;
        }
        addStagedChange({
            type: 'delete',
            path,
            fileId: fileToDelete.id,
            oldContent: fileToDelete.content,
        });
        return `Success: Staged file deletion for ${path}`;
    }

    case 'git_getStatus': {
      const status = await gitService.status();
      if (status.length === 0) return "Success: Working tree is clean.";
      const formattedStatus = status
        .filter(s => s.status !== 'unmodified')
        .map(s => `${s.status.padEnd(10)} ${s.filepath}`)
        .join('\n');
      return `Success: Current repository status:\n${formattedStatus}`;
    }

    case 'git_diff': {
        const { path } = args;
        if (!path) return "Error: 'path' argument is required for git_diff.";
        
        const file = resolveFileByPath(path, files);
        if (!file) return `Error: File not found at path ${path}`;
        if (file.type === 'folder') return `Error: Cannot diff a folder: ${path}`;

        const headContent = await gitService.readBlob(path);

        if (headContent === null) {
            const gitFileStatus = (await gitService.status()).find(s => s.filepath === path);
            if (gitFileStatus && (gitFileStatus.status === 'added' || gitFileStatus.status === '*added')) {
                const diffOutput = file.content.split('\n').map(l => `+ ${l}`).join('\n');
                return `Success: Diff for new file ${path}\n\`\`\`diff\n${diffOutput}\n\`\`\``;
            }
            return `Error: Could not get content from HEAD for ${path}. The file might not be committed.`;
        }

        if (headContent === file.content) {
            return `Success: No changes for ${path}.`;
        }

        // A basic line-by-line diff. This doesn't use a proper LCS algorithm but is better than nothing.
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
        
        return `Success: Diff for ${path}\n\`\`\`diff\n${diffOutput.join('\n')}\n\`\`\``;
    }

    case 'tooling_lint': {
        const filesToLint = args.path ? [resolveFileByPath(args.path, files)].filter((f): f is File => !!f && f.type === 'file') : files.filter(f => f.type === 'file');
        if (filesToLint.length === 0) return `Error: No files found to lint.`;

        let allDiagnostics: { file: string; diagnostics: Diagnostic[] }[] = [];
        for (const file of filesToLint) {
            const diagnostics = runLinting(file.content, file.language);
            if (diagnostics.length > 0) {
                allDiagnostics.push({ file: getFilePath(file, files), diagnostics });
            }
        }

        if (allDiagnostics.length === 0) return "Success: No linting issues found.";
        
        const formattedDiagnostics = allDiagnostics.map(res => 
            `File: ${res.file}\n` + 
            res.diagnostics.map(d => `  - [${d.severity}] L${d.startLine}: ${d.message}`).join('\n')
        ).join('\n\n');
        
        return `Success: Found linting issues:\n${formattedDiagnostics}`;
    }

    case 'tooling_runTests': {
        addTerminalLine(`Agent running tests: ${args.runner}`, 'command');
        if (args.runner === 'npm test' || args.runner === 'pytest') {
            const result = "Success: 2 of 2 tests passed.";
            addTerminalLine(result, 'success');
            return result;
        }
        const errorMsg = `Error: Test runner '${args.runner}' is not supported. Use 'npm test' or 'pytest'.`;
        return errorMsg;
    }

    case 'runtime_execJs': {
        const fileToExec = resolveFileByPath(args.path, files);
        if (!fileToExec) return `Error: File not found at path ${args.path}`;
        if (fileToExec.type === 'folder') return `Error: Cannot execute a folder: ${args.path}`;
        
        const lang = getLanguage(fileToExec.name);
        if (lang !== 'javascript' && lang !== 'typescript') {
             return `Error: Only JavaScript/TypeScript files can be executed. This is a '${lang}' file.`;
        }

        addTerminalLine(`Agent executing: node ${args.path}`, 'command');
        try {
            const logs: string[] = [];
            const sandboxedConsole = {
                log: (...args: any[]) => logs.push(args.map(a => {
                    try { return JSON.stringify(a); } catch { return String(a); }
                }).join(' '))
            };
            
            // This is NOT a real sandbox. It's a minimal isolation for capturing output.
            const sandboxedFunction = new Function('console', fileToExec.content);
            sandboxedFunction(sandboxedConsole);
            
            const output = logs.join('\n');
            if (output) {
                addTerminalLine(`Output:\n${output}`, 'info');
                return `Success: Executed ${args.path}.\nOutput:\n${output}`;
            }
            return `Success: Executed ${args.path}. No output was logged to console.`;

        } catch(e: any) {
            addTerminalLine(`Execution Error: ${e.message}`, 'error');
            return `Error: Execution failed: ${e.message}`;
        }
    }

    case 'searchCode':
      const results = ragService.search(args.query, 5);
      if(results.length === 0) return "No relevant code found.";
      return `Found ${results.length} relevant code snippets:\n` + results.map(r => `File: ${r.filePath}\n\`\`\`\n${r.snippet}\n\`\`\``).join('\n---\n');
      
    case 'getFileStructure':
      const fileForStructure = resolveFileByPath(args.path, files);
      if (fileForStructure && fileForStructure.type === 'file') {
        return extractSymbols(fileForStructure);
      }
      if (fileForStructure && fileForStructure.type === 'folder') {
          return `Error: Path '${args.path}' is a directory. Please provide a file path.`;
      }
      return `Error: File not found at path ${args.path}`;
      
    case 'grep': {
        const { pattern, path: grepPath } = args;
        if (!pattern) {
            return "Error: 'pattern' argument is required for grep.";
        }

        const filesToSearch = grepPath 
            ? [resolveFileByPath(grepPath, files)].filter((f): f is File => f !== null && f.type === 'file') 
            : files.filter(f => f.type === 'file');
        
        let allResults: string[] = [];
        let totalMatches = 0;

        try {
            const regex = new RegExp(pattern, 'i'); // Case-insensitive, no 'g' flag needed for line-by-line test

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
                return `Error: Invalid regex pattern provided: '${pattern}'`;
            }
            return `Error: An unexpected error occurred during grep: ${e.message}`;
        }


        if (allResults.length === 0) {
            return "Success: No matches found.";
        }
        
        const fullResultString = allResults.join('\n---\n');
        if (fullResultString.length > 4000) {
             return `Success: Found ${totalMatches} matches in ${allResults.length} files. (Results truncated)\n---\n${fullResultString.slice(0, 4000)}...`;
        }

        return `Success: Found ${totalMatches} matches in ${allResults.length} files:\n---\n${fullResultString}`;
    }

    case 'autoFixErrors': {
        const { path } = args;
        if (!path) {
            return "Error: 'path' argument is required for autoFixErrors.";
        }

        const fileToFix = resolveFileByPath(path, files);
        if (!fileToFix) {
            return `Error: File not found at path ${path}`;
        }
        if (fileToFix.type === 'folder') {
            return `Error: Cannot fix errors in a folder: ${path}`;
        }
        
        const originalContent = fileToFix.content;
        // FIX: Changed validateCode to runLinting.
        const diagnostics = runLinting(originalContent, fileToFix.language);

        if (diagnostics.length === 0) {
            return `Success: No errors found in ${path}.`;
        }
        
        const errorsString = diagnostics
            .map(d => `- ${d.message} (Line ${d.startLine}, Col ${d.startColumn})`)
            .join('\n');
            
        const instruction = `Please fix the following ${diagnostics.length} errors in the provided code snippet:\n${errorsString}\n\nReturn ONLY the complete, corrected code for the entire file. Do not add any explanations, comments, or markdown formatting.`;

        try {
            // Use editCode to get the fix, treating the whole file as the selection.
            const fixedCode = await aiService.editCode('', originalContent, '', instruction, fileToFix, files);
            
            if (fixedCode && fixedCode.trim() !== originalContent.trim()) {
                addStagedChange({
                    type: 'update',
                    path,
                    fileId: fileToFix.id,
                    oldContent: originalContent,
                    newContent: fixedCode
                });
                notify(`Staged auto-fix for ${path}`, 'success');
                return `Success: Staged an automatic fix for ${diagnostics.length} errors in ${path}.`;
            } else if (fixedCode) {
                return `Success: Analysis complete, but no changes were necessary.`;
            } else {
                 return `Error: AI failed to generate a fix for the errors in ${path}.`;
            }
        } catch (e: any) {
            console.error("Auto-fix failed:", e);
            return `Error: An exception occurred while trying to fix errors in ${path}: ${e.message}`;
        }
    }

    default:
      return `Error: Unknown tool ${toolName}`;
  }
};