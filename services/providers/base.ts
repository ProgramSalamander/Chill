import { Tool, Type } from "@google/genai";
import { AIModelConfig } from "../../types";

// --- API Key Management ---
export const getApiKey = (config: AIModelConfig): string => {
    if (config.apiKey) return config.apiKey;
    if (config.provider === 'gemini') return process.env.API_KEY || '';
    return '';
};

// --- Agent Personas ---

export const PERSONAS = {
  planner: {
    name: "Architect",
    role: "planner",
    instruction: `You are the Lead Architect for a software squad. 
    Your goal is to break down a user's request into a concrete, sequential plan of action.
    You do NOT write code. You delegate tasks to the 'coder' (for implementation) and 'tester' (for verification).
    
    When creating steps:
    - If the step involves writing or modifying features, assign it to 'coder'.
    - If the step involves creating tests or validating logic, assign it to 'tester'.
    - If the user asks for a fix, you can assign to 'debugger'.`
  },
  coder: {
    name: "Engineer",
    role: "coder",
    instruction: `You are the Senior Software Engineer (Coder Agent). 
    Your responsibility is to implement the requested features with high-quality, efficient code.
    You have access to file system tools. 
    Always check the file structure first if you are unsure where files are located.
    Write clean, modern code.`
  },
  tester: {
    name: "QA Specialist",
    role: "tester",
    instruction: `You are the QA Specialist (Testing Agent).
    Your goal is to ensure code integrity.
    You should write unit tests (e.g., using a simple test runner pattern or creating .test.ts files).
    You can also use 'runCommand' to execute validation scripts.
    Focus on edge cases and reliability.`
  },
  debugger: {
    name: "Debugger",
    role: "debugger",
    instruction: `You are the Rapid Response Debugger (Debugging Agent).
    Your goal is to fix errors immediately.
    Analyze the error message provided by the user or the system.
    Propose specific code changes or command executions to resolve the issue.
    Do not hesitate to rewrite code if it fixes the bug.`
  }
};

// --- Tool Definitions ---

export const AGENT_TOOLS_GEMINI: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "listFiles",
        description: "List all files and folders in the project structure to understand the hierarchy.",
        parameters: {
          type: Type.OBJECT,
          properties: {
             root: { type: Type.STRING, description: "Optional root path to list from" }
          },
        }
      },
      {
        name: "readFile",
        description: "Read the content of a file.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "The full path of the file to read (e.g., 'src/components/App.tsx')" }
          },
          required: ["path"]
        }
      },
      {
        name: "writeFile",
        description: "Create or overwrite a file with provided content. Use this to save code.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "The path of the file to write." },
            content: { type: Type.STRING, description: "The full content to write to the file." }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "runCommand",
        description: "Execute a shell command (simulated). Use for running tests or installing packages.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            command: { type: Type.STRING, description: "The command to execute." }
          },
          required: ["command"]
        }
      },
      {
        name: "searchCode",
        description: "Semantic search across the codebase using RAG.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "The search query." }
          },
          required: ["query"]
        }
      },
      {
        name: "getFileStructure",
        description: "Get symbols and structure of a specific file.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "The file path." }
          },
          required: ["path"]
        }
      },
      {
        name: "grep",
        description: "Searches for exact keywords or regex patterns within files. Useful for finding specific variable names, function calls, or configuration values.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            pattern: { type: Type.STRING, description: "The keyword or regex pattern to search for." },
            path: { type: Type.STRING, description: "Optional. The specific file path to search in. If omitted, searches the entire project." }
          },
          required: ["pattern"]
        }
      }
    ]
  }
];

export const AGENT_TOOLS_OPENAI: any[] = AGENT_TOOLS_GEMINI[0].functionDeclarations!.map(fd => ({
    type: 'function',
    function: {
        name: fd.name,
        description: fd.description,
        parameters: {
            ...(fd.parameters as any),
            properties: Object.fromEntries(
                Object.entries((fd.parameters as any).properties).map(([key, value]) => {
                    const { type, ...rest } = value as any;
                    return [key, { ...rest, type: type.toLowerCase() }];
                })
            )
        }
    }
}));