import { AIProviderAdapter, AIModelConfig, AISession, AIResponse, AIToolResponse, Message, MessageRole, AgentPlanItem } from "../../types";
import { AGENT_TOOLS_OPENAI, getApiKey } from "./base";

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

    constructor(systemInstruction: string, history: Message[] = [], isAgent: boolean = false, config: AIModelConfig) {
        this.modelConfig = config;
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

export class OpenAIProvider implements AIProviderAdapter {
  createChatSession(props: { systemInstruction: string; history?: Message[]; isAgent?: boolean; config: AIModelConfig; }): AISession {
    return new OpenAISession(props.systemInstruction, props.history, props.isAgent, props.config);
  }

  async generateText(props: { prompt: string; config: AIModelConfig; options?: { temperature?: number | undefined; maxOutputTokens?: number | undefined; } | undefined; }): Promise<string> {
    const apiKey = getApiKey(props.config);
    if (!apiKey) throw new Error("API Key not configured for OpenAI provider.");

    const endpoint = `${(props.config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
    const body: any = {
        model: props.config.modelId,
        messages: [{ role: 'user', content: props.prompt }],
        temperature: props.options?.temperature || 0.2,
        max_tokens: props.options?.maxOutputTokens
    };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content || '';
  }

  async generateAgentPlan(props: { goal: string; context: string; config: AIModelConfig; }): Promise<AgentPlanItem[]> {
    const prompt = this.getPlanPrompt(props.goal, props.context);
    const apiKey = getApiKey(props.config);
    const endpoint = `${(props.config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
    
    const body: any = {
        model: props.config.modelId,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
    };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`);
    const data = await res.json();
    const responseText = data.choices[0].message.content || '{"plan":[]}';
    const parsed = JSON.parse(responseText);
    return parsed.plan;
  }
  
  private getPlanPrompt(goal: string, context: string): string {
    return `You are a senior software architect. Your task is to break down a user's request into a detailed, step-by-step implementation plan.

Analyze the following request and context, then generate a JSON object with a single key "plan" which is an array of plan steps.

GOAL: ${goal}
CONTEXT: ${context}

You MUST return a valid JSON object where the "plan" key contains an array where each object is a step with the following properties:
- id: A unique string identifier for the step (e.g., "step-1").
- title: A short, descriptive title for the step.
- description: A detailed explanation of what needs to be done.
- status: The initial status, which MUST be "pending".
- assignedAgent: The agent responsible. Must be one of: 'coder', 'tester', 'debugger', or 'user'.
- dependencies: An array of IDs of other steps that must be completed before this step can start. Use this to enforce order.

Example Output:
{
  "plan": [
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
}

Ensure your response is ONLY the JSON object and nothing else.`;
  }
}