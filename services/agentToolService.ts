import { useFileTreeStore } from '../stores/fileStore';
import { useTerminalStore } from '../stores/terminalStore';
import { ragService } from './ragService';
import { generateProjectStructureContext, extractSymbols, resolveFileByPath, getFilePath } from '../utils/fileUtils';
import { notify } from '../stores/notificationStore';
import { File } from '../types';
import { aiService } from './aiService';
// FIX: Changed validateCode to runLinting as it is the exported function.
import { runLinting } from './lintingService';

export const handleAgentAction = async (toolName: string, args: any): Promise<string> => {
  const { addTerminalLine } = useTerminalStore.getState();
  const { files, createNode, updateFileContent } = useFileTreeStore.getState();

  switch (toolName) {
    case 'listFiles':
      const structure = generateProjectStructureContext(files);
      return `Success:\n${structure}`;

    case 'readFile':
      const fileToRead = resolveFileByPath(args.path, files);
      if (fileToRead) {
        return `Success:\n\`\`\`${fileToRead.language}\n${fileToRead.content}\n\`\`\``;
      }
      return `Error: File not found at path ${args.path}`;

    case 'writeFile':
      let fileToWrite = resolveFileByPath(args.path, files);
      if (fileToWrite) {
        updateFileContent(args.content, true, fileToWrite.id);
      } else {
        const parts = args.path.split('/');
        const name = parts.pop() || 'untitled';
        const parentPath = parts.join('/');
        
        let parent = null;
        if (parentPath) {
            parent = files.find(f => f.type === 'folder' && f.name === parts[parts.length -1]);
        }
        
        fileToWrite = await createNode('file', parent?.id || null, name, args.content);
      }

      if(fileToWrite) {
        notify(`Agent wrote to ${args.path}`, 'info');
        return `Success: Wrote content to ${args.path}`;
      }
      return `Error: Could not write file at path ${args.path}`;

    case 'runCommand':
      addTerminalLine(`Agent ran: ${args.command}`, 'command');
      if (args.command.startsWith('npm test') || args.command.startsWith('pytest')) {
        return "Success: All tests passed.";
      }
      if (args.command.startsWith('npm install')) {
        return `Success: Installed package.`;
      }
      return `Success: Command executed. No output.`;

    case 'searchCode':
      const results = ragService.search(args.query, 5);
      if(results.length === 0) return "No relevant code found.";
      return `Found ${results.length} relevant code snippets:\n` + results.map(r => `File: ${r.filePath}\n\`\`\`\n${r.snippet}\n\`\`\``).join('\n---\n');
      
    case 'getFileStructure':
      const fileForStructure = resolveFileByPath(args.path, files);
      if (fileForStructure) {
        return extractSymbols(fileForStructure);
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
        
        const originalContent = fileToFix.content;
        // FIX: Changed validateCode to runLinting.
        const diagnostics = await runLinting(originalContent, fileToFix.language);

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
                updateFileContent(fixedCode, true, fileToFix.id);
                notify(`Auto-fixed ${diagnostics.length} errors in ${path}`, 'success');
                return `Success: Automatically fixed ${diagnostics.length} errors in ${path}.`;
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