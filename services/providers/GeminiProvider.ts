
import { GoogleGenAI, GenerateContentResponse, Part, Type } from "@google/genai";
import { AIProviderAdapter, AIModelProfile, AISession, AIResponse, AIToolResponse, Message, MessageRole, AgentPlanItem, AIUsageMetadata } from "../../types";
import { AGENT_TOOLS_GEMINI, getApiKey } from "./base";

class GeminiSession implements AISession {
  private chat: any;

  constructor(systemInstruction: string, history: Message[] = [], isAgent: boolean = false, config: AIModelProfile) {
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
        message: parts.length > 0 ? parts : props.message
    });
    
    return this.parseResponse(response);
  }

  async sendMessageStream(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AsyncIterable<{ text: string, usage?: AIUsageMetadata }>> {
    if (props.toolResponses) {
        const response = await this.sendMessage(props);
        return (async function* () { yield { text: response.text, usage: response.usage }; })();
    }

    const resultStream = await this.chat.sendMessageStream({ message: props.message });
    
    return (async function* () {
      for await (const chunk of resultStream) {
        yield { 
            text: chunk.text || '',
            usage: chunk.usageMetadata ? {
                promptTokenCount: chunk.usageMetadata.promptTokenCount,
                candidatesTokenCount: chunk.usageMetadata.candidatesTokenCount,
                totalTokenCount: chunk.usageMetadata.totalTokenCount,
                thinkingTokenCount: (chunk.usageMetadata as any).thinkingTokenCount
            } : undefined
        };
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

    const usage: AIUsageMetadata | undefined = response.usageMetadata ? {
        promptTokenCount: response.usageMetadata.promptTokenCount,
        candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
        totalTokenCount: response.usageMetadata.totalTokenCount,
        thinkingTokenCount: (response.usageMetadata as any).thinkingTokenCount
    } : undefined;

    return {
      text,
      toolCalls: functionCalls,
      usage
    };
  }
}


export class GeminiProvider implements AIProviderAdapter {
  createChatSession(props: { systemInstruction: string; history?: Message[]; isAgent?: boolean; config: AIModelProfile; }): AISession {
    return new GeminiSession(props.systemInstruction, props.history, props.isAgent, props.config);
  }

  async generateText(props: { prompt: string; config: AIModelProfile; options?: { temperature?: number | undefined; maxOutputTokens?: number | undefined; } | undefined; }): Promise<{ text: string, usage?: AIUsageMetadata }> {
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

    const usage: AIUsageMetadata | undefined = response.usageMetadata ? {
        promptTokenCount: response.usageMetadata.promptTokenCount,
        candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
        totalTokenCount: response.usageMetadata.totalTokenCount,
        thinkingTokenCount: (response.usageMetadata as any).thinkingTokenCount
    } : undefined;

    return { text: response.text || '', usage };
  }

  async generateAgentPlan(props: { goal: string; context: string; config: AIModelProfile; }): Promise<AgentPlanItem[]> {
    const geminiSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                status: { type: Type.STRING, enum: ['pending'] },
                assignedAgent: { type: Type.STRING, enum: ['planner', 'coder', 'tester', 'debugger', 'user'] },
                dependencies: { type: Type.ARRAY, items: { type: Type.STRING } }
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
- dependencies: An array of IDs of other steps that must be completed before this step can start. Use this to enforce order.

Example Output:
[
    {
      "id": "step-1",
      "title": "Set up project structure",
      "description": "Create the initial project folders and files based on best practices.",
      "status": "pending",
      "assignedAgent": "coder",
      "dependencies": []
    },
    {
      "id": "step-2",
      "title": "Implement core logic",
      "description": "Write the main application logic.",
      "status": "pending",
      "assignedAgent": "coder",
      "dependencies": ["step-1"]
    }
]

Ensure your response is ONLY the JSON array and nothing else.`;
  }
}
