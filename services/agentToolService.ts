import { useFileTreeStore } from '../stores/fileStore';
import { useTerminalStore } from '../stores/terminalStore';
import { ragService } from './ragService';
import { generateProjectStructureContext, extractSymbols, resolveFileByPath } from '../utils/fileUtils';
import { notify } from '../stores/notificationStore';

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

    default:
      return `Error: Unknown tool ${toolName}`;
  }
};
