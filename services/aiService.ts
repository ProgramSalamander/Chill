import { getAIConfig, getActiveChatConfig, getActiveCompletionConfig } from "./configService";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { AIModelProfile, Message, AgentPlanItem, AISession, AIProviderAdapter, File } from "../types";
import { useTerminalStore } from "../stores/terminalStore";

class AIService {
  private getProvider(config: AIModelProfile): AIProviderAdapter {
    if (config.provider === 'openai') {
      return new OpenAIProvider();
    }
    return new GeminiProvider();
  }

  // --- CHAT SESSION ---
  createChatSession(props: {
    systemInstruction: string,
    history?: Message[],
    isAgent?: boolean,
    config: AIModelProfile
  }): AISession {
    const provider = this.getProvider(props.config);
    return provider.createChatSession(props);
  }

  sendMessageStream(session: AISession, message: string) {
    return session.sendMessageStream({ message });
  }

  // --- AGENT PLANNING ---
  async generateAgentPlan(props: {
    goal: string,
    context: string
  }): Promise<AgentPlanItem[]> {
    const config = getActiveChatConfig();
    if (!config) {
        console.error("No active chat model configured for agent planning.");
        return [];
    }
    try {
        const provider = this.getProvider(config);
        return await provider.generateAgentPlan({ ...props, config });
    } catch (e: any) {
        console.error("Failed to generate or parse plan", e);
        useTerminalStore.getState().addTerminalLine(`Failed to generate agent plan: ${e.message}`, 'error');
        return [];
    }
  }
  
  // --- GENERIC TEXT GENERATION (used internally now) ---
  private generateText(
    config: AIModelProfile,
    prompt: string,
    options: {
      temperature?: number;
      maxOutputTokens?: number;
    } = {}
  ): Promise<string> {
    const provider = this.getProvider(config);
    return provider.generateText({ prompt, config, options });
  }

  // --- SPECIFIC AI TASKS ---

  async generateCommitMessage(diff: string): Promise<string> {
    const config = getActiveCompletionConfig();
    if (!config) return "Update files";

    const prompt = `Generate a concise, conventional commit message (max 50 chars) for these changes:\n${diff.slice(0, 2000)}`;
    try {
        const response = await this.generateText(config, prompt);
        return response.trim() || "Update files";
    } catch (e: any) {
        console.error("AI Error generating commit message:", e);
        useTerminalStore.getState().addTerminalLine(`AI commit message generation failed.`, 'warning');
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
    const config = getActiveCompletionConfig();
    if (!config) return null;

    const codeBeforeCursor = code.slice(0, offset);
    const codeAfterCursor = code.slice(offset);
    
    const linesBefore = codeBeforeCursor.split('\n');
    const lastLineBefore = linesBefore[linesBefore.length - 1];
    const firstLineAfter = codeAfterCursor.split('\n')[0];

    const context = codeBeforeCursor.slice(-1000); // 1000 chars before cursor

    const prompt = `You are a code completion engine. Your task is to complete the code at the cursor position.
Respond with ONLY the code snippet that should be inserted. Do not add explanations or markdown formatting.
Pay close attention to formatting and indentation.

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

Complete the code at the cursor position.`;
    
    console.log('[aiService] getCodeCompletion prompt:', { language, filename: file.name, context: `...${context.slice(-100)}[CURSOR]` });

    try {
        const response = await this.generateText(config, prompt, { temperature: 0.2, maxOutputTokens: 128 });
        
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

        // Trim exact overlaps between the suggestion and surrounding context
        if (cleanedResponse) {
            // Trim leading overlap that duplicates the start of codeAfterCursor
            const maxLead = Math.min(cleanedResponse.length, codeAfterCursor.length);
            for (let i = maxLead; i > 0; i--) {
                if (cleanedResponse.endsWith(codeAfterCursor.slice(0, i))) {
                    cleanedResponse = cleanedResponse.slice(0, cleanedResponse.length - i);
                    break;
                }
            }

            // Trim trailing overlap that duplicates the end of codeBeforeCursor
            const maxTrail = Math.min(cleanedResponse.length, codeBeforeCursor.length);
            for (let i = maxTrail; i > 0; i--) {
                if (cleanedResponse.startsWith(codeBeforeCursor.slice(codeBeforeCursor.length - i))) {
                    cleanedResponse = cleanedResponse.slice(i);
                    break;
                }
            }

            if (cleanedResponse.trim().length === 0) cleanedResponse = null;
        }
        
        console.log('[aiService] Cleaned completion response:', cleanedResponse);
        return cleanedResponse ? cleanedResponse : null;
    } catch (e: any) {
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
    const config = getActiveCompletionConfig();
    if (!config) return null;

    const prompt = `Instruction: ${instruction}\n\nFile: ${file.name}\nLanguage: ${file.language}\n\nCode Context:\n${prefix.slice(-500)}\n[START SELECTION]\n${selection}\n[END SELECTION]\n${suffix.slice(0, 500)}\n\nRewrite the [SELECTION] based on the instruction. Return ONLY the new code for the selection.`;
    
    try {
        const text = await this.generateText(config, prompt);
        if (!text) {
          return null;
        }

        let cleanedText = text.trim();
        if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
        }
        
        return cleanedText ? cleanedText : null;
    } catch (e: any) {
        console.error("Failed to edit code with AI:", e);
        useTerminalStore.getState().addTerminalLine(`AI code edit failed: ${e.message}`, 'error');
        return null;
    }
  }
}

export const aiService = new AIService();