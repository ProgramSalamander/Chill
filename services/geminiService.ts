

import { GoogleGenAI, Content, GenerateContentResponse, Tool, Type, Schema, Part, FunctionDeclaration } from "@google/genai";
import { Message, MessageRole, AIConfig, AIModelConfig, AISession, AIResponse, AIToolCall, AIToolResponse, File, AgentPlanItem, AgentRole } from '../types';
import { getAIConfig } from './configService';
import { ragService } from './ragService';
import { getFilePath } from '../utils/fileUtils';

// --- API Key Management ---
const getApiKey = (config: AIModelConfig): string => {
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

const AGENT_TOOLS_OPENAI: any[] = AGENT_TOOLS_GEMINI[0].functionDeclarations.map(fd => ({
    type: 'function',
    function: {
        name: fd.name,
        description: fd.description,
        parameters: {
            ...(fd.parameters as any),
            properties: Object.fromEntries(
                Object.entries(fd.parameters.properties).map(([key, value]) => {
                    const { type, ...rest } = value as any;
                    return [key, { ...rest, type: type.toLowerCase() }];
                })
            )
        }
    }
}));


// --- Gemini Session Implementation ---

class GeminiSession implements AISession {
  private chat: any;
  private modelConfig: AIModelConfig;

  constructor(systemInstruction: string, history: Message[] = [], isAgent: boolean = false) {
    this.modelConfig = getAIConfig().chat;
    const apiKey = getApiKey(this.modelConfig);
    const ai = new GoogleGenAI({ apiKey });
    
    const geminiHistory = history.map(msg => ({
      role: msg.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    this.chat = ai.chats.create({
      model: this.modelConfig.modelId,
      history: geminiHistory,
      config: {
        systemInstruction,
        tools: isAgent ? AGENT_TOOLS_GEMINI : undefined,
        temperature: isAgent ? 0 : 0.7,
      }
    });
  }

  async sendMessage(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AIResponse> {
    let parts: Part[] = [];

    if (props.toolResponses && props.toolResponses.length > 0) {
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

    const response: GenerateContentResponse = await this.chat.sendMessage({ 
        content: parts.length > 0 ? { parts } : props.message 
    });
    
    return this.parseResponse(response);
  }

  async sendMessageStream(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AsyncIterable<{ text: string }>> {
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

// --- OpenAI Session Implementation ---

const toOpenAIMessages = (messages: Message[]) => {
    return messages.map(msg => ({
        role: msg.role === MessageRole.MODEL ? 'assistant' : msg.role as ('user' | 'system'),
        content: msg.text
    }));
};

class OpenAISession implements AISession {
    private modelConfig: AIModelConfig;
    private systemInstruction: string;
    private history: Message[];
    private isAgent: boolean;

    constructor(systemInstruction: string, history: Message[] = [], isAgent: boolean = false) {
        this.modelConfig = getAIConfig().chat;
        this.systemInstruction = systemInstruction;
        this.history = history;
        this.isAgent = isAgent;
    }

    private async performFetch(body: any): Promise<Response> {
        const apiKey = getApiKey(this.modelConfig);
        const { baseUrl, modelId } = this.modelConfig;
        const endpoint = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
        
        return fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelId,
                ...body
            })
        });
    }

    async sendMessage(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AIResponse> {
        const messages: any[] = [
            { role: 'system', content: this.systemInstruction },
            ...toOpenAIMessages(this.history)
        ];

        if (props.message) {
            messages.push({ role: 'user', content: props.message });
        }
        
        if (props.toolResponses) {
            props.toolResponses.forEach(tr => {
                messages.push({
                    role: 'tool',
                    tool_call_id: tr.id,
                    content: JSON.stringify(tr.result)
                });
            });
        }

        const body: any = { messages };
        if (this.isAgent) {
            body.tools = AGENT_TOOLS_OPENAI;
            body.tool_choice = "auto";
        }

        const res = await this.performFetch(body);
        if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`);

        const data = await res.json();
        const responseMsg = data.choices[0].message;

        if (props.message) this.history.push({ id: Date.now().toString(), role: MessageRole.USER, text: props.message, timestamp: Date.now() });
        this.history.push({ id: (Date.now() + 1).toString(), role: MessageRole.MODEL, text: responseMsg.content || 'Tool call', timestamp: Date.now() });

        const aiResponse: AIResponse = { text: responseMsg.content || '' };
        if (responseMsg.tool_calls) {
            aiResponse.toolCalls = responseMsg.tool_calls.map((tc: any) => ({
                id: tc.id,
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
            }));
        }
        
        return aiResponse;
    }

    async sendMessageStream(props: { message: string }): Promise<AsyncIterable<{ text: string }>> {
        const messages: any[] = [
            { role: 'system', content: this.systemInstruction },
            ...toOpenAIMessages(this.history),
            { role: 'user', content: props.message }
        ];

        const body = { messages, stream: true };
        const res = await this.performFetch(body);
        if (!res.ok) throw new Error(`OpenAI API stream error: ${await res.text()}`);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        return (async function* () {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data.trim() === '[DONE]') return;
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices[0]?.delta?.content;
                            if (delta) {
                                yield { text: delta };
                            }
                        } catch (e) { /* ignore parse errors on incomplete chunks */ }
                    }
                }
            }
        })();
    }
}


// --- Session Factory ---

export const createChatSession = (systemInstruction: string, history: Message[] = [], isAgent: boolean = false): AISession => {
  const config = getAIConfig().chat;
  if (config.provider === 'openai') {
    return new OpenAISession(systemInstruction, history, isAgent);
  }
  return new GeminiSession(systemInstruction, history, isAgent);
};

export const sendMessageStream = async (session: AISession, message: string) => {
  return session.sendMessageStream({ message });
};

// --- Generic Text Generation Helper ---
async function generateGeneric(
    prompt: string,
    config: AIModelConfig,
    options: { responseMimeType?: string, responseSchema?: any, temperature?: number, maxOutputTokens?: number } = {}
): Promise<string> {
    const apiKey = getApiKey(config);
    if (!apiKey) throw new Error("API Key not configured.");

    if (config.provider === 'openai') {
        const endpoint = `${(config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
        const body: any = {
            model: config.modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature || 0.2,
            max_tokens: options.maxOutputTokens
        };
        if (options.responseMimeType === 'application/json') {
            body.response_format = { type: "json_object" };
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`);
        const data = await res.json();
        return data.choices[0].message.content || '';
    } else {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: config.modelId,
            contents: prompt,
            config: {
                temperature: options.temperature,
                maxOutputTokens: options.maxOutputTokens,
                responseMimeType: options.responseMimeType,
                responseSchema: options.responseSchema,
            }
        });
        return response.text || '';
    }
}


// --- Agent Planning ---

export const generateAgentPlan = async (goal: string, context: string): Promise<AgentPlanItem[]> => {
    const config = getAIConfig().chat;
    const geminiSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                status: { type: Type.STRING, enum: ['pending'] },
                assignedAgent: { type: Type.STRING, enum: ['planner', 'coder', 'tester', 'debugger', 'user'] }
            },
            required: ['id', 'title', 'description', 'status', 'assignedAgent']
        }
    };
    
    const prompt: string = `You are a senior software architect. Your task is to break down a user's request into a detailed, step-by-step implementation plan.

Analyze the following request and context, then generate a JSON array of plan steps.

GOAL: ${goal}
CONTEXT: ${context}

You MUST return a valid JSON array where each object is a step with the following properties:
- id: A unique string identifier for the step (e.g., "step-1").
- title: A short, descriptive title for the step.
- description: A detailed explanation of what needs to be done.
- status: The initial status, which MUST be "pending".
- assignedAgent: The agent responsible. Must be one of: 'coder', 'tester', 'debugger', or 'user'.

Ensure your response is ONLY the raw JSON array and nothing else.`;

    try {
        const responseText = await generateGeneric(prompt, config, {
            responseMimeType: 'application/json',
            responseSchema: config.provider === 'gemini' ? geminiSchema : undefined,
        });
        const parsed = JSON.parse(responseText);
        return config.provider === 'openai' ? parsed.plan : parsed;
    } catch (e) {
        console.error("Failed to parse plan", e);
        return [];
    }
};

// --- Utility Functions ---

export const generateCommitMessage = async (diff: string): Promise<string> => {
    const config = getAIConfig().completion;
    const prompt = `Generate a concise, conventional commit message (max 50 chars) for these changes:\n${diff.slice(0, 2000)}`;
    try {
        const response = await generateGeneric(prompt, config);
        return response.trim() || "Update files";
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
    const config = getAIConfig().completion;
    const prompt = `You are a code completion engine. Complete the code at the cursor.\nLanguage: ${language}\nFilename: ${file.name}\n\nContext:\n${prefix.slice(-1000)}\n\nReturn ONLY the completion code. No markdown. No explanation.`;
    try {
        const response = await generateGeneric(prompt, config, { temperature: 0.2, maxOutputTokens: 64 });
        return response || null;
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
    const config = getAIConfig().completion;
    const prompt = `Instruction: ${instruction}\n\nFile: ${file.name}\nLanguage: ${file.language}\n\nCode Context:\n${prefix.slice(-500)}\n[START SELECTION]\n${selection}\n[END SELECTION]\n${suffix.slice(0, 500)}\n\nRewrite the [SELECTION] based on the instruction. Return ONLY the new code for the selection.`;
    
    try {
        let text = await generateGeneric(prompt, config);
        if (text.startsWith('```')) {
            text = text.replace(/```\w*\n?/, '').replace(/```$/, '');
        }
        return text.trim();
    } catch (e) {
        console.error(e);
        return null;
    }
};
