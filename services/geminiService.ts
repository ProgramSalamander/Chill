


import { GoogleGenAI, Chat, Content, GenerateContentResponse, Tool, Type } from "@google/genai";
import { Message, MessageRole, AIConfig, AIModelConfig, AISession, AIResponse, AIToolCall, AIToolResponse, File } from '../types';
import { getAIConfig } from './configService';
import { ragService } from './ragService';
import { getFilePath } from '../utils/fileUtils';

// Safely get env var
const ENV_API_KEY = typeof process !== 'undefined' ? process.env.API_KEY : '';

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
        description: "Create or overwrite a file with new content.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "The full path of the file" },
            content: { type: Type.STRING, description: "The full content to write to the file" }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "runCommand",
        description: "Run a system command.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            command: { type: Type.STRING, description: "The shell command to execute" }
          },
          required: ["command"]
        }
      }
    ]
  }
];

// Convert Gemini Tools to OpenAI Format
const getOpenAITools = () => {
  return AGENT_TOOLS_GEMINI[0].functionDeclarations?.map(fn => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters
    }
  }));
};

// --- Helper Functions ---

const removeOverlap = (suggestion: string, suffix: string): string => {
    // Check for overlap at the end of suggestion matching start of suffix
    const maxCheck = Math.min(suggestion.length, suffix.length);

    for (let i = maxCheck; i > 0; i--) {
        const sTail = suggestion.slice(-i);
        const sHead = suffix.slice(0, i);
        if (sTail === sHead) {
            return suggestion.slice(0, -i);
        }
    }
    return suggestion;
};

// --- Providers ---

class GeminiSessionWrapper implements AISession {
  private chat: Chat;

  constructor(apiKey: string, model: string, systemInstruction: string, history: Message[], tools?: boolean) {
    const ai = new GoogleGenAI({ apiKey: apiKey || ENV_API_KEY || '' });
    
    // Convert history to Gemini format
    const geminiHistory: Content[] = history
      .filter(m => m.role !== MessageRole.SYSTEM)
      .map(m => ({
        role: m.role === MessageRole.MODEL ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

    this.chat = ai.chats.create({
      model: model,
      history: geminiHistory,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: tools ? AGENT_TOOLS_GEMINI : undefined
      }
    });
  }

  async sendMessage(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AIResponse> {
    let response;
    
    if (props.toolResponses) {
      // Map back to Gemini tool response format
      const toolParts = props.toolResponses.map(tr => ({
        functionResponse: {
          name: tr.name,
          response: { result: tr.result }
        }
      }));
      response = await this.chat.sendMessage({ message: toolParts as any });
    } else {
      response = await this.chat.sendMessage({ message: props.message });
    }

    const toolCalls: AIToolCall[] | undefined = response.candidates?.[0]?.content?.parts
      ?.filter(p => p.functionCall)
      .map(p => ({
        id: 'gemini-call', // Gemini doesn't use IDs in the same way, we rely on sequential turn logic in the SDK
        name: p.functionCall!.name,
        args: p.functionCall!.args
      }));

    return {
      text: response.text || '',
      toolCalls
    };
  }

  async sendMessageStream(props: { message: string }): Promise<AsyncIterable<{ text: string }>> {
    const stream = await this.chat.sendMessageStream({ message: props.message });
    
    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of stream) {
          if (chunk.text) {
             yield { text: chunk.text };
          }
        }
      }
    };
  }
}

class OpenAISessionWrapper implements AISession {
  private config: AIModelConfig;
  private history: any[];
  private systemInstruction: string;
  private tools?: any[];

  constructor(config: AIModelConfig, systemInstruction: string, history: Message[], tools?: boolean) {
    this.config = config;
    this.systemInstruction = systemInstruction;
    this.tools = tools ? getOpenAITools() : undefined;
    
    this.history = history
        .filter(m => m.role !== MessageRole.SYSTEM)
        .map(m => ({
            role: m.role === MessageRole.MODEL ? 'assistant' : 'user',
            content: m.text
        }));
    
    // Add system message
    this.history.unshift({ role: 'system', content: systemInstruction });
  }

  private async fetchOpenAI(messages: any[], stream: boolean = false) {
    const url = `${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.modelId,
        messages: messages,
        tools: this.tools,
        stream: stream
      })
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error(`OpenAI Error (${response.status}): ${err}`);
    }
    return response;
  }

  async sendMessage(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AIResponse> {
    // 1. Update history with user message OR tool outputs
    if (props.toolResponses) {
       // For OpenAI, we must provide the tool outputs corresponding to previous calls
       for (const tr of props.toolResponses) {
           this.history.push({
               role: 'tool',
               tool_call_id: tr.id,
               content: JSON.stringify(tr.result) // OpenAI expects string content for tool results
           });
       }
    } else {
       this.history.push({ role: 'user', content: props.message });
    }

    // 2. Call API
    const res = await this.fetchOpenAI(this.history, false);
    const data = await res.json();
    const message = data.choices[0].message;

    // 3. Update history with assistant response
    this.history.push(message);

    // 4. Map response
    let toolCalls: AIToolCall[] | undefined;
    if (message.tool_calls) {
        toolCalls = message.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
        }));
    }

    return {
        text: message.content || '',
        toolCalls
    };
  }

  async sendMessageStream(props: { message: string }): Promise<AsyncIterable<{ text: string }>> {
    this.history.push({ role: 'user', content: props.message });
    const res = await this.fetchOpenAI(this.history, true);
    
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    // We need to accumulate the full response to save to history after stream
    let fullResponse = ''; 
    const historyRef = this.history;

    return {
      async *[Symbol.asyncIterator]() {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line === 'data: [DONE]') return;
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.slice(6));
                            const text = json.choices[0]?.delta?.content || '';
                            if (text) {
                                fullResponse += text;
                                yield { text };
                            }
                        } catch (e) {
                            console.warn("Error parsing SSE", e);
                        }
                    }
                }
            }
        } finally {
            // Save complete message to history
            historyRef.push({ role: 'assistant', content: fullResponse });
        }
      }
    };
  }
}

// --- Factory Functions ---

export const createChatSession = (systemInstruction: string, history: Message[], tools: boolean = false): AISession => {
  const config = getAIConfig();
  
  if (config.chat.provider === 'openai') {
    return new OpenAISessionWrapper(config.chat, systemInstruction, history, tools);
  } else {
    // Default to Gemini
    return new GeminiSessionWrapper(config.chat.apiKey, config.chat.modelId, systemInstruction, history, tools);
  }
};

export const sendMessageStream = async (
  session: AISession, 
  message: string
): Promise<AsyncIterable<{ text: string }>> => {
  return await session.sendMessageStream({ message });
};

// --- Completion & Editing ---

export const getCodeCompletion = async (
  code: string,
  cursorOffset: number,
  language: string,
  activeFile: File | null,
  allFiles: File[]
): Promise<string> => {
  const config = getAIConfig();
  
  // 1. Prepare Context
  const prefix = code.slice(0, cursorOffset);
  const suffix = code.slice(cursorOffset);

  const ragQuery = prefix.split('\n').slice(-10).join('\n');
  const projectContext = ragService.getContext(ragQuery, activeFile, allFiles, 2);
  const filePath = activeFile ? getFilePath(activeFile, allFiles) : 'untitled';

  // 2. New, highly-engineered prompt structure
  const systemPrompt = `You are a highly intelligent, low-latency code completion engine. Your sole purpose is to generate the missing code that connects a provided "Prefix" and "Suffix" seamlessly.

**Operational Rules:**
1.  **Output Format:** Return ONLY the code sequence to fill the gap. Do NOT include markdown blocks (\`\`\`), explanations, or conversational text.
2.  **Context Awareness:** Analyze the indentation, variable naming conventions, and coding style of the ${language} code in the Prefix/Suffix. Mimic this style exactly.
3.  **Syntactic Integrity:** Ensure the generated code creates a syntactically valid bridge between the Prefix and Suffix.
4.  **Suffix Handling:** Look at the Suffix carefully. Do NOT repeat code that already exists immediately after the cursor. If the Suffix contains the closing brace/parenthesis, do not generate it again.
5.  **Indentation:** Your output must start with the correct indentation level relative to the Prefix.

**Heuristics:**
- If the cursor is inside a string/comment, complete the text.
- If the cursor is inside a function signature, complete the arguments/types.
- If the cursor is at the start of a block, generate the logic for that block.
- If the intent is unclear, generate the minimum valid code to continue the line.

**Efficiency:**
- Prefer concise, idiomatic solutions.
- Do not add comments unless the surrounding code is heavily commented.`;

  const userPrompt = `**Context:**
File: ${filePath}
Language: ${language}
${projectContext ? `
**Relevant Context:**
The following definitions are available in the project and may be relevant to the completion:
<IMPORTS>
${projectContext}
</IMPORTS>
` : ''}
**Code Structure:**
<PREFIX>
${prefix.slice(-3000)}
</PREFIX>
<SUFFIX>
${suffix.slice(0, 1000)}
</SUFFIX>

**Task:**
Generate the code that belongs strictly between </PREFIX> and <SUFFIX>.`;

  try {
    let text = "";

    if (config.completion.provider === 'openai') {
      const url = `${config.completion.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.completion.apiKey}`
        },
        body: JSON.stringify({
          model: config.completion.modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 128,
          stop: ["```", "\n\n"]
        })
      });
      if (!res.ok) throw new Error(`OpenAI completion failed: ${res.statusText}`);
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || "";
    } else {
      // Gemini Completion
      const ai = new GoogleGenAI({ apiKey: config.completion.apiKey || ENV_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: config.completion.modelId,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 128,
          temperature: 0.1,
          stopSequences: ["```", "\n\n"]
        }
      });
      text = response.text || "";
    }
    
    // 3. Post-Processing
    text = text.replace(/^```\w*\n/, '').replace(/```$/, '');
    text = removeOverlap(text, suffix);
    
    return text;

  } catch (error) {
    console.error("Completion Error:", error);
    return "";
  }
};


export const editCode = async (
  prefix: string,
  selectedText: string,
  suffix: string,
  instruction: string,
  activeFile: File | null,
  allFiles: File[]
): Promise<string> => {
   const config = getAIConfig();
   
   const ragQuery = instruction + "\n" + selectedText;
   const projectContext = ragService.getContext(ragQuery, activeFile, allFiles);
   
   const prompt = `
   You are an AI code editor.
   ${projectContext ? `[SMART CONTEXT]\n${projectContext}\n` : ''}
   
   [CODE_BEFORE]
   ${prefix.slice(-2000)}
   
   [CODE_TO_EDIT_OR_INSERT_LOCATION]
   ${selectedText || '(Cursor is here)'}
   
   [CODE_AFTER]
   ${suffix.slice(0, 2000)}
   
   [INSTRUCTION]
   ${instruction}
   
   TASK: Return ONLY the code that should replace [CODE_TO_EDIT_OR_INSERT_LOCATION]. 
   If it is an insertion, return the inserted code.
   Do NOT return the before/after context.
   Do NOT use markdown block ticks (\`\`\`).
   `;

   try {
       const session = createChatSession("You are a strict code editor. Output raw code only.", []);
       const response = await session.sendMessage({ message: prompt });
       let text = response.text || "";
       
       // Cleanup if model adds markdown despite instructions
       text = text.replace(/^```\w*\n/, '').replace(/```$/, '');
       return text;
   } catch (e) {
       console.error("Edit Code Error", e);
       return "";
   }
};

export const generateCommitMessage = async (diff: string): Promise<string> => {
   // Use Chat Config for commits as it requires "smarts"
   const config = getAIConfig();
   const prompt = `Generate a concise commit message (e.g., 'feat: ...') for:\n${diff.slice(0, 10000)}`;
   
   // Helper reuse
   const session = createChatSession("You are a git expert.", []);
   const response = await session.sendMessage({ message: prompt });
   return response.text.trim();
};

export const generateCodeExplanation = async (code: string): Promise<string> => {
    const session = createChatSession("You are a coding tutor.", []);
    const response = await session.sendMessage({ message: `Explain this:\n${code}` });
    return response.text;
};