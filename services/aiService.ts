import { getAIConfig } from "./configService";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { AIModelConfig, Message, AgentPlanItem, AISession, AIProviderAdapter, File } from "../types";

class AIService {
  private getProvider(config: AIModelConfig): AIProviderAdapter {
    if (config.provider === 'openai') {
      return new OpenAIProvider();
    }
    return new GeminiProvider();
  }

  // --- CHAT SESSION ---
  createChatSession(props: {
    systemInstruction: string,
    history?: Message[],
    isAgent?: boolean
  }): AISession {
    const config = getAIConfig().chat;
    const provider = this.getProvider(config);
    return provider.createChatSession({ ...props, config });
  }

  sendMessageStream(session: AISession, message: string) {
    return session.sendMessageStream({ message });
  }

  // --- AGENT PLANNING ---
  async generateAgentPlan(props: {
    goal: string,
    context: string
  }): Promise<AgentPlanItem[]> {
    try {
        const config = getAIConfig().chat;
        const provider = this.getProvider(config);
        return await provider.generateAgentPlan({ ...props, config });
    } catch (e) {
        console.error("Failed to generate or parse plan", e);
        return [];
    }
  }
  
  // --- GENERIC TEXT GENERATION ---
  generateText(
    configType: 'chat' | 'completion',
    prompt: string,
    options: {
      temperature?: number;
      maxOutputTokens?: number;
    } = {}
  ): Promise<string> {
    const config = getAIConfig()[configType];
    const provider = this.getProvider(config);
    return provider.generateText({ prompt, config, options });
  }

  // --- SPECIFIC AI TASKS ---

  async generateCommitMessage(diff: string): Promise<string> {
    const prompt = `Generate a concise, conventional commit message (max 50 chars) for these changes:\n${diff.slice(0, 2000)}`;
    try {
        const response = await this.generateText('completion', prompt);
        return response.trim() || "Update files";
    } catch (e) {
        return "Update files";
    }
  }

  async getCodeCompletion(
    prefix: string, 
    offset: number, 
    language: string, 
    file: File, 
    allFiles: File[]
  ): Promise<string | null> {
    const prompt = `You are a code completion engine. Complete the code at the cursor.\nLanguage: ${language}\nFilename: ${file.name}\n\nContext:\n${prefix.slice(-1000)}\n\nReturn ONLY the completion code. No markdown. No explanation.`;
    try {
        const response = await this.generateText('completion', prompt, { temperature: 0.2, maxOutputTokens: 64 });
        return response || null;
    } catch (e) {
        return null;
    }
  }

  async editCode(
    prefix: string, 
    selection: string, 
    suffix: string, 
    instruction: string, 
    file: File, 
    allFiles: File[]
  ): Promise<string | null> {
    const prompt = `Instruction: ${instruction}\n\nFile: ${file.name}\nLanguage: ${file.language}\n\nCode Context:\n${prefix.slice(-500)}\n[START SELECTION]\n${selection}\n[END SELECTION]\n${suffix.slice(0, 500)}\n\nRewrite the [SELECTION] based on the instruction. Return ONLY the new code for the selection.`;
    
    try {
        let text = await this.generateText('completion', prompt);
        if (text.startsWith('```')) {
            text = text.replace(/```\w*\n?/, '').replace(/```$/, '');
        }
        return text.trim();
    } catch (e) {
        console.error(e);
        return null;
    }
  }
}

export const aiService = new AIService();
