

import { getAIConfig, getActiveChatConfig, getActiveCompletionConfig } from "./configService";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { AIModelProfile, Message, AgentPlanItem, AISession, AIProviderAdapter, File, AIUsageMetadata } from "../types";
import { errorService } from "./errorService";
import { useUsageStore } from "../stores/usageStore";

class AIService {
  private getProvider(config: AIModelProfile): AIProviderAdapter {
    if (config.provider === 'openai') {
      return new OpenAIProvider();
    }
    return new GeminiProvider();
  }

  private track(config: AIModelProfile, usage?: AIUsageMetadata, type: 'chat' | 'agent' | 'completion' | 'planning' = 'completion') {
    if (usage) {
        useUsageStore.getState().recordUsage(config.modelId, config.provider, usage, type);
    }
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
        errorService.report("No active chat model configured for agent planning.", "AI Service", { notifyUser: true });
        return [];
    }
    try {
        const provider = this.getProvider(config);
        // We don't easily get usage for plan generation since it's a direct prompt usually 
        // but we could track it if we updated the provider interface to return it
        return await provider.generateAgentPlan({ ...props, config });
    } catch (e: any) {
        errorService.report(e, "AI Service (Planning)");
        return [];
    }
  }
  
  // --- GENERIC TEXT GENERATION (used internally now) ---
  private async generateText(
    config: AIModelProfile,
    prompt: string,
    options: {
      temperature?: number;
      maxOutputTokens?: number;
      signal?: AbortSignal;
    } = {},
    type: 'chat' | 'agent' | 'completion' | 'planning' = 'completion'
  ): Promise<string> {
    const provider = this.getProvider(config);
    const result = await provider.generateText({ prompt, config, options });
    this.track(config, result.usage, type);
    return result.text;
  }

  // --- SPECIFIC AI TASKS ---

  async generateCommitMessage(diff: string): Promise<string> {
    const config = getActiveCompletionConfig();
    if (!config) return "Update files";

    const prompt = `Generate a concise, conventional commit message (max 50 chars) for these changes:\n${diff.slice(0, 2000)}`;
    try {
        const response = await this.generateText(config, prompt, {}, 'completion');
        return response.trim() || "Update files";
    } catch (e: any) {
        errorService.report(e, "AI Service (Commit Message)", { silent: true, severity: 'warning' });
        return "Update files";
    }
  }

  async getCodeCompletion(
    code: string, 
    offset: number, 
    language: string, 
    file: File, 
    allFiles: File[],
    signal?: AbortSignal
  ): Promise<string | null> {
    const config = getActiveCompletionConfig();
    if (!config) return null;

    const codeBeforeCursor = code.slice(0, offset);
    const codeAfterCursor = code.slice(offset);
    
    const linesBefore = codeBeforeCursor.split('\n');
    const lastLineBefore = linesBefore[linesBefore.length - 1];
    const firstLineAfter = codeAfterCursor.split('\n')[0];

    // Smart Context Construction
    // Current models (Gemini 1.5/2.5/3 Flash) handle large contexts efficiently.
    // Strategy: 
    // 1. If file is small (< 30k chars), send full file.
    // 2. If file is large, send Header (Imports/Types) + Active Block around cursor.
    
    const MAX_FULL_CONTEXT = 30000;
    let contextBlock = "";

    if (code.length <= MAX_FULL_CONTEXT) {
        contextBlock = `
Code before cursor:
---
${codeBeforeCursor}
---

Code after cursor:
---
${codeAfterCursor}
---`;
    } else {
        // Large file strategy
        // Capture imports/defs at top
        const header = code.substring(0, 2500); 
        // Capture immediate context (8k before, 3k after)
        const activeBlockBefore = codeBeforeCursor.slice(-8000); 
        const activeBlockAfter = codeAfterCursor.slice(0, 3000); 
        
        // Avoid duplicating header if cursor is near top
        const isHeaderOverlapping = offset < 10500; // rough check
        const effectiveHeader = isHeaderOverlapping ? "" : header;

        contextBlock = `
${effectiveHeader ? `File Header (Imports/Global Types):\n---\n${effectiveHeader}\n---\n\n... [content skipped] ...\n` : ''}

Code before cursor (active region):
---
${activeBlockBefore}
---

Code after cursor (active region):
---
${activeBlockAfter}
---`;
    }

    const prompt = `You are a code completion engine. Your task is to complete the code at the cursor position.
Respond with ONLY the code snippet that should be inserted. Do not add explanations or markdown formatting.
Pay close attention to formatting and indentation.

Language: ${language}
File: ${file.name}
The code on the same line before the cursor is: "${lastLineBefore.trim()}"
The code on the same line after the cursor is: "${firstLineAfter.trim()}"

${contextBlock}

Complete the code at the cursor position.`;
    
    try {
        const response = await this.generateText(
            config, 
            prompt, 
            { temperature: 0.2, maxOutputTokens: 164, signal }, 
            'completion'
        );
        
        if (!response) {
            return null;
        }

        let cleanedResponse = response;
        const trimmedResponse = response.trim();
        if (trimmedResponse.startsWith('```') && trimmedResponse.endsWith('```')) {
            cleanedResponse = trimmedResponse.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
        }

        if (cleanedResponse) {
            const maxLead = Math.min(cleanedResponse.length, codeAfterCursor.length);
            for (let i = maxLead; i > 0; i--) {
                if (cleanedResponse.endsWith(codeAfterCursor.slice(0, i))) {
                    cleanedResponse = cleanedResponse.slice(0, cleanedResponse.length - i);
                    break;
                }
            }

            const maxTrail = Math.min(cleanedResponse.length, codeBeforeCursor.length);
            for (let i = maxTrail; i > 0; i--) {
                if (cleanedResponse.startsWith(codeBeforeCursor.slice(codeBeforeCursor.length - i))) {
                    cleanedResponse = cleanedResponse.slice(i);
                    break;
                }
            }

            if (cleanedResponse.trim().length === 0) cleanedResponse = null;
        }
        
        return cleanedResponse ? cleanedResponse : null;
    } catch (e: any) {
        if (e.name === 'AbortError' || e.message === 'Aborted') {
            // Intentionally silent
            return null;
        }
        errorService.report(e, "AI Service (Completion)", { silent: true, terminal: false, severity: 'warning' });
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

    const prompt = `Instruction: ${instruction}\n\nFile: ${file.name}\nLanguage: ${file.language}\n\nCode Context:\n${prefix.slice(-2000)}\n[START SELECTION]\n${selection}\n[END SELECTION]\n${suffix.slice(0, 2000)}\n\nRewrite the [SELECTION] based on the instruction. Return ONLY the new code for the selection.`;
    
    try {
        const text = await this.generateText(config, prompt, {}, 'completion');
        if (!text) {
          return null;
        }

        let cleanedText = text.trim();
        if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
        }
        
        return cleanedText ? cleanedText : null;
    } catch (e: any) {
        errorService.report(e, "AI Service (Code Edit)");
        return null;
    }
  }
}

export const aiService = new AIService();
