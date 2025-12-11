
import { GoogleGenAI, Content, GenerateContentResponse, Tool, Type, Schema, Part, FunctionDeclaration } from "@google/genai";
import { Message, MessageRole, AIConfig, AIModelConfig, AISession, AIResponse, AIToolCall, AIToolResponse, File, AgentPlanItem, AgentRole } from '../types';
import { getAIConfig } from './configService';
import { ragService } from './ragService';
import { getFilePath } from '../utils/fileUtils';

const ENV_API_KEY = process.env.API_KEY || '';

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

const AGENT_TOOLS_GEMINI: Tool[] = [
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
      }
    ]
  }
];

// --- Session Implementation ---

class GeminiSession implements AISession {
  private chat: any;
  private modelId: string;

  constructor(systemInstruction: string, history: Message[] = [], isAgent: boolean = false) {
    const ai = new GoogleGenAI({ apiKey: ENV_API_KEY });
    // Use Pro for agents (complex reasoning), Flash for generic chat
    this.modelId = isAgent ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
    
    // Transform history to Gemini format
    const geminiHistory = history.map(msg => ({
      role: msg.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    this.chat = ai.chats.create({
      model: this.modelId,
      history: geminiHistory,
      config: {
        systemInstruction,
        tools: isAgent ? AGENT_TOOLS_GEMINI : undefined,
        temperature: isAgent ? 0 : 0.7, // Deterministic for agents
      }
    });
  }

  async sendMessage(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AIResponse> {
    let parts: Part[] = [];

    if (props.toolResponses && props.toolResponses.length > 0) {
      // Send tool responses
      const functionResponses = props.toolResponses.map(tr => ({
        id: tr.id,
        name: tr.name,
        response: { result: tr.result }
      }));
      parts = [{ functionResponse: { name: functionResponses[0].name, response: functionResponses[0].response } }]; // SDK expects simple structure for single response or array
      // Actually @google/genai SDK format for functionResponse:
      // parts: [{ functionResponse: { name: string, response: object, id?: string } }]
      
      // Fix for SDK type alignment:
      parts = props.toolResponses.map(tr => ({
          functionResponse: {
              name: tr.name,
              response: { result: tr.result },
              id: tr.id
          }
      }));
    } 
    
    if (props.message) {
      parts.push({ text: props.message });
    }

    // If we have parts, send them. If generic text message only, send string.
    const response: GenerateContentResponse = await this.chat.sendMessage({ 
        content: parts.length > 0 ? parts : props.message 
    });
    
    return this.parseResponse(response);
  }

  async sendMessageStream(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AsyncIterable<{ text: string }>> {
    // Basic streaming implementation for text-only for now
    // Tool usage in streaming is complex, fallback to non-streaming if tools present for simplicity in this demo
    if (props.toolResponses) {
        const response = await this.sendMessage(props);
        return (async function* () { yield { text: response.text }; })();
    }

    const resultStream = await this.chat.sendMessageStream({ content: props.message });
    
    return (async function* () {
      for await (const chunk of resultStream) {
        yield { text: chunk.text || '' };
      }
    })();
  }

  private parseResponse(response: GenerateContentResponse): AIResponse {
    const text = response.text || '';
    const functionCalls = response.functionCalls?.map(fc => ({
      id: fc.id || 'unknown',
      name: fc.name,
      args: fc.args
    }));

    return {
      text,
      toolCalls: functionCalls
    };
  }
}


// --- Exported Functions ---

export const createChatSession = (systemInstruction: string, history: Message[] = [], isAgent: boolean = false): AISession => {
  return new GeminiSession(systemInstruction, history, isAgent);
};

export const sendMessageStream = async (session: AISession, message: string) => {
  return session.sendMessageStream({ message });
};

// --- Agent Planning ---

export const generateAgentPlan = async (goal: string, context: string): Promise<AgentPlanItem[]> => {
    const ai = new GoogleGenAI({ apiKey: ENV_API_KEY });
    
    const prompt = `
    GOAL: ${goal}
    CONTEXT: ${context}
    
    Create a step-by-step implementation plan for an autonomous coding agent.
    Each step should be clear, actionable, and assigned to a specific role.
    
    Roles:
    - planner: Breaks down tasks (you are doing this now)
    - coder: Writes/Modifies code
    - tester: Verifies changes
    - debugger: Fixes issues
    
    Return a JSON array of steps.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Use Pro for reasoning
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        status: { type: Type.STRING, enum: ['pending'] }, // Initial status
                        assignedAgent: { type: Type.STRING, enum: ['planner', 'coder', 'tester', 'debugger', 'user'] }
                    },
                    required: ['id', 'title', 'description', 'status', 'assignedAgent']
                }
            }
        }
    });

    try {
        const text = response.text || '[]';
        return JSON.parse(text) as AgentPlanItem[];
    } catch (e) {
        console.error("Failed to parse plan", e);
        return [];
    }
};

// --- Utility Functions ---

export const generateCommitMessage = async (diff: string): Promise<string> => {
    if (!ENV_API_KEY) return "Update files";
    const ai = new GoogleGenAI({ apiKey: ENV_API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a concise, conventional commit message (max 50 chars) for these changes:\n${diff.slice(0, 2000)}`,
        });
        return response.text?.trim() || "Update files";
    } catch (e) {
        return "Update files";
    }
};

export const getCodeCompletion = async (
    prefix: string, 
    offset: number, 
    language: string, 
    file: File, 
    allFiles: File[]
): Promise<string | null> => {
    if (!ENV_API_KEY) return null;
    
    // Quick debounce check handled in UI, here we just request
    const ai = new GoogleGenAI({ apiKey: ENV_API_KEY });
    
    // Small context window for speed
    const prompt = `
    You are a code completion engine. Complete the code at the cursor.
    Language: ${language}
    Filename: ${file.name}
    
    Context:
    ${prefix.slice(-1000)}
    
    Return ONLY the completion code. No markdown. No explanation.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2,
                maxOutputTokens: 64
            }
        });
        return response.text || null;
    } catch (e) {
        return null;
    }
};

export const editCode = async (
    prefix: string, 
    selection: string, 
    suffix: string, 
    instruction: string, 
    file: File, 
    allFiles: File[]
): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: ENV_API_KEY });
    
    const prompt = `
    Instruction: ${instruction}
    
    File: ${file.name}
    Language: ${file.language}
    
    Code Context:
    ${prefix.slice(-500)}
    [START SELECTION]
    ${selection}
    [END SELECTION]
    ${suffix.slice(0, 500)}
    
    Rewrite the [SELECTION] based on the instruction.
    Return ONLY the new code for the selection.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        
        let text = response.text || '';
        // Strip markdown if present
        if (text.startsWith('```')) {
            text = text.replace(/```\w*\n?/, '').replace(/```$/, '');
        }
        return text.trim();
    } catch (e) {
        console.error(e);
        return null;
    }
};
