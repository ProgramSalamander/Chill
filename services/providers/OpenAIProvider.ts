
import { AIProviderAdapter, AIModelProfile, AISession, AIResponse, AIUsageMetadata, AIToolResponse, Message, MessageRole, AgentPlanItem } from "../../types";
import { AGENT_TOOLS_OPENAI, getApiKey } from "./base";

const filterEmptyMessages = (messages: any[]) => {
    return messages.filter(m => m.content && m.content.trim() !== "" || (m.tool_calls && m.tool_calls.length > 0) || m.role === 'tool');
};

const toOpenAIMessages = (messages: Message[]) => {
    return messages.map(msg => ({
        role: msg.role === MessageRole.MODEL ? 'assistant' : msg.role as ('user' | 'system'),
        content: msg.text
    }));
};

class OpenAISession implements AISession {
    private modelConfig: AIModelProfile;
    private systemInstruction: string;
    private history: Message[];
    private isAgent: boolean;

    constructor(systemInstruction: string, history: Message[] = [], isAgent: boolean = false, config: AIModelProfile) {
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

        // 核心修复：工具回复必须紧跟在 history 之后（响应上一个 assistant 的 tool_calls）
        if (props.toolResponses && props.toolResponses.length > 0) {
            props.toolResponses.forEach(tr => {
                messages.push({
                    role: 'tool',
                    tool_call_id: tr.id,
                    content: JSON.stringify(tr.result)
                });
            });
        }

        // 只有当消息不为空时才添加 user 消息
        if (props.message && props.message.trim() !== "") {
            messages.push({ role: 'user', content: props.message });
        }

        const body: any = { 
            messages: filterEmptyMessages(messages) 
        };
        
        if (this.isAgent) {
            body.tools = AGENT_TOOLS_OPENAI;
            body.tool_choice = "auto";
        }

        const res = await this.performFetch(body);
        if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`);

        const data = await res.json();
        const responseMsg = data.choices[0].message;

        if (props.message && props.message.trim() !== "") {
            this.history.push({ id: Date.now().toString(), role: MessageRole.USER, text: props.message, timestamp: Date.now() });
        }
        
        this.history.push({ 
            id: (Date.now() + 1).toString(), 
            role: MessageRole.MODEL, 
            text: responseMsg.content || '', 
            timestamp: Date.now() 
        });

        const usage: AIUsageMetadata | undefined = data.usage ? {
            promptTokenCount: data.usage.prompt_tokens,
            candidatesTokenCount: data.usage.completion_tokens,
            totalTokenCount: data.usage.total_tokens
        } : undefined;

        const aiResponse: AIResponse = { text: responseMsg.content || '', usage };
        if (responseMsg.tool_calls) {
            aiResponse.toolCalls = responseMsg.tool_calls.map((tc: any) => ({
                id: tc.id,
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
            }));
        }
        
        return aiResponse;
    }

    async sendMessageStream(props: { message: string, toolResponses?: AIToolResponse[] }): Promise<AsyncIterable<{ text: string, usage?: AIUsageMetadata }>> {
        // 如果有工具回复，流式传输通常不适用，直接降级到普通发送
        if (props.toolResponses && props.toolResponses.length > 0) {
            const response = await this.sendMessage(props);
            return (async function* () { yield { text: response.text, usage: response.usage }; })();
        }

        const messages: any[] = [
            { role: 'system', content: this.systemInstruction },
            ...toOpenAIMessages(this.history)
        ];
        
        if (props.message && props.message.trim() !== "") {
            messages.push({ role: 'user', content: props.message });
        }

        const body = { 
            messages: filterEmptyMessages(messages), 
            stream: true, 
            stream_options: { include_usage: true } 
        };
        
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
                            if (parsed.usage) {
                                yield { 
                                    text: '',
                                    usage: {
                                        promptTokenCount: parsed.usage.prompt_tokens,
                                        candidatesTokenCount: parsed.usage.completion_tokens,
                                        totalTokenCount: parsed.usage.total_tokens
                                    }
                                };
                            }
                        } catch (e) { }
                    }
                }
            }
        })();
    }
}

export class OpenAIProvider implements AIProviderAdapter {
  createChatSession(props: { systemInstruction: string; history?: Message[]; isAgent?: boolean; config: AIModelProfile; }): AISession {
    return new OpenAISession(props.systemInstruction, props.history, props.isAgent, props.config);
  }

  async generateText(props: { prompt: string; config: AIModelProfile; options?: { temperature?: number | undefined; maxOutputTokens?: number | undefined; signal?: AbortSignal; } | undefined; }): Promise<{ text: string, usage?: AIUsageMetadata }> {
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
        signal: props.options?.signal
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`);
    const data = await res.json();
    
    const usage: AIUsageMetadata | undefined = data.usage ? {
        promptTokenCount: data.usage.prompt_tokens,
        candidatesTokenCount: data.usage.completion_tokens,
        totalTokenCount: data.usage.total_tokens
    } : undefined;

    return { text: data.choices[0].message.content || '', usage };
  }

  async generateAgentPlan(props: { goal: string; context: string; config: AIModelProfile; }): Promise<AgentPlanItem[]> {
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
