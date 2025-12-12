import { GoogleGenAI, GenerateContentResponse, Part, Type } from "@google/genai";
import { AIProviderAdapter, AIModelConfig, AISession, AIResponse, AIToolResponse, Message, MessageRole, AgentPlanItem } from "../../types";
import { AGENT_TOOLS_GEMINI, getApiKey } from "./base";

// --- Gemini Session Implementation ---

class GeminiSession implements AISession {
  private chat: any;

  constructor(systemInstruction: string, history: Message[] = [], isAgent: boolean = false, config: AIModelConfig) {
    const apiKey = getApiKey(config);
    const ai = new GoogleGenAI({ apiKey });
    
    const geminiHistory = history.map(msg => ({
      role: msg.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    this.chat = ai.chats.create({
      model: config.modelId,
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


export class GeminiProvider implements AIProviderAdapter {
  createChatSession(props: { systemInstruction: string; history?: Message[]; isAgent?: boolean; config: AIModelConfig; }): AISession {
    return new GeminiSession(props.systemInstruction, props.history, props.isAgent, props.config);
  }

  async generateText(props: { prompt: string; config: AIModelConfig; options?: { temperature?: number | undefined; maxOutputTokens?: number | undefined; } | undefined; }): Promise<string> {
    const apiKey = getApiKey(props.config);
    if (!apiKey) throw new Error("API Key not configured for Gemini.");
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: props.config.modelId,
        contents: props.prompt,
        config: {
            temperature: props.options?.temperature,
            maxOutputTokens: props.options?.maxOutputTokens,
        }
    });
    return response.text || '';
  }

  async generateAgentPlan(props: { goal: string; context: string; config: AIModelConfig; }): Promise<AgentPlanItem[]> {
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
    
    const prompt = this.getPlanPrompt(props.goal, props.context);
    const apiKey = getApiKey(props.config);
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
        model: props.config.modelId,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: geminiSchema,
        }
    });
    
    const parsed = JSON.parse(response.text || '[]');
    return parsed;
  }

  private getPlanPrompt(goal: string, context: string): string {
    return `You are a senior software architect. Your task is to break down a user's request into a detailed, step-by-step implementation plan.

Analyze the following request and context, then generate a JSON array of plan steps.

GOAL: ${goal}
CONTEXT: ${context}

You MUST return a valid JSON array where each object is a step with the following properties:
- id: A unique string identifier for the step (e.g., "step-1").
- title: A short, descriptive title for the step.
- description: A detailed explanation of what needs to be done.
- status: The initial status, which MUST be "pending".
- assignedAgent: The agent responsible. Must be one of: 'coder', 'tester', 'debugger', or 'user'.

Example Output:
[
    {
      "id": "step-1",
      "title": "Set up project structure",
      "description": "Create the initial project folders and files based on best practices.",
      "status": "pending",
      "assignedAgent": "coder"
    }
]

Ensure your response is ONLY the JSON array and nothing else.`;
  }
}
