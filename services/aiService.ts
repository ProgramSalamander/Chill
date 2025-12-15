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
    code: string, 
    offset: number, 
    language: string, 
    file: File, 
    allFiles: File[]
  ): Promise<string | null> {
    const codeBeforeCursor = code.slice(0, offset);
    const codeAfterCursor = code.slice(offset);
    
    const linesBefore = codeBeforeCursor.split('\n');
    const lastLineBefore = linesBefore[linesBefore.length - 1];
    const firstLineAfter = codeAfterCursor.split('\n')[0];

    const context = codeBeforeCursor.slice(-1000); // 1000 chars before cursor

    const prompt = `You are a code completion engine. Your task is to complete the code at the cursor position.
Respond with ONLY the code snippet that should be inserted. Do not add explanations or markdown formatting.
Pay close attention to formatting and indentation. If the completion should start on a new line, it MUST begin with a newline character ('\\n').

Language: ${language}
File: ${file.name}
The code on the same line before the cursor is: "${lastLineBefore.trim()}"
The code on the same line after the cursor is: "${firstLineAfter.trim()}"

Code before cursor (including current line):
---
${context}
---

Code after cursor (including current line):
---
${codeAfterCursor.slice(0, 500)}
---

Complete the code at the cursor position. Remember to start with '\\n' and proper indentation if the completion belongs on a new line.`;
    
    console.log('[aiService] getCodeCompletion prompt:', { language, filename: file.name, context: `...${context.slice(-100)}[CURSOR]` });

    try {
        const response = await this.generateText('completion', prompt, { temperature: 0.2, maxOutputTokens: 128 });
        
        console.log('[aiService] Raw completion response:', response);

        if (!response) {
            return null;
        }

        let cleanedResponse = response;
        // Strip markdown fences if the model includes them by mistake, but preserve surrounding whitespace.
        const trimmedResponse = response.trim();
        if (trimmedResponse.startsWith('```') && trimmedResponse.endsWith('```')) {
            cleanedResponse = trimmedResponse.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        }
        
        console.log('[aiService] Cleaned completion response:', cleanedResponse);
        return cleanedResponse ? cleanedResponse : null;
    } catch (e) {
        console.error('[aiService] getCodeCompletion error:', e);
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
        const text = await this.generateText('completion', prompt);
        if (!text) {
          return null;
        }

        let cleanedText = text.trim();
        if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
        }
        
        return cleanedText ? cleanedText : null;
    } catch (e) {
        console.error(e);
        return null;
    }
  }
}

export const aiService = new AIService();