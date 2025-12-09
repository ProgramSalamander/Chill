
import { GoogleGenAI, Chat, Content, GenerateContentResponse } from "@google/genai";
import { Message, MessageRole } from '../types';

// Helper to get a fresh client instance with the latest env key
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const createChatSession = (systemInstruction: string, history?: Content[]): Chat => {
  return getAI().chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction,
      temperature: 0.7,
      // Removed maxOutputTokens per guidelines to avoid conflicts
    },
  });
};

export const sendMessageStream = async (
  chat: Chat, 
  message: string
): Promise<AsyncIterable<GenerateContentResponse>> => {
  try {
    return await chat.sendMessageStream({ message });
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateCodeExplanation = async (code: string): Promise<string> => {
  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Explain the following code briefly and concisely:\n\n${code}`,
    });
    return response.text || "Could not generate explanation.";
  } catch (error) {
    console.error("Gemini Explanation Error:", error);
    return "Error connecting to AI service.";
  }
};

export const getCodeCompletion = async (
  code: string, 
  cursorOffset: number, 
  language: string,
  projectContext: string = ''
): Promise<string> => {
  try {
    const ai = getAI();
    
    // Split code at cursor for context
    const prefix = code.slice(0, cursorOffset);
    const suffix = code.slice(cursorOffset);
    
    // Limit context size to avoid token limits and keep it focused
    const contextPrefix = prefix.slice(-2500);
    const contextSuffix = suffix.slice(0, 1000);

    const prompt = `You are a super-fast, intelligent coding assistant for an IDE. 
    Your task is to provide the missing code at the cursor location.

    ${projectContext ? `[GLOBAL PROJECT CONTEXT]\n${projectContext}\n` : ''}

    [CURRENT FILE CONTEXT]
    Language: ${language}

    Code:
    [BEGIN PRE-CURSOR]
    ${contextPrefix}
    [END PRE-CURSOR]
    [CURSOR]
    [BEGIN POST-CURSOR]
    ${contextSuffix}
    [END POST-CURSOR]

    Instructions:
    1. Output ONLY the code that belongs exactly at [CURSOR] to complete the current thought, line, or block.
    2. Analyze the [GLOBAL PROJECT CONTEXT] to suggest correct variable names, imports, and types defined in other files.
    3. Do NOT repeat the last character or word from the PRE-CURSOR. The output must start exactly where the cursor is.
    4. Do NOT repeat the start of the POST-CURSOR.
    5. If the code is complete, return an empty string.
    6. Provide the raw code directly. No markdown formatting (no \`\`\`).
    7. Be concise.

    Response:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 128,
        temperature: 0.1,
        // Stop if it tries to start a new block or conversation
        stopSequences: ["[BEGIN", "[END", "```"] 
      }
    });

    let completion = response.text || "";
    // Sanitize any leaked markdown or excessive whitespace
    completion = completion.replace(/^```\w*\n/, '').replace(/```$/, '');
    return completion;
  } catch (error: any) {
    // Gracefully handle quota exhaustion (429)
    if (error.status === 429 || error.code === 429 || error.message?.includes('429')) {
      console.warn("Gemini API Quota Exceeded for completion. Please wait a moment.");
      return "";
    }
    console.error("Completion Error:", error);
    return "";
  }
};

export const generateCommitMessage = async (diff: string): Promise<string> => {
  try {
    const ai = getAI();
    const prompt = `You are an expert developer. Generate a concise, conventional commit message (e.g., 'feat: add login', 'fix: resolve crash') for the following file changes.
    
    Rules:
    1. Return ONLY the commit message text.
    2. No markdown formatting (no \`\`\`).
    3. Keep it under 72 characters if possible.
    
    Changes:
    ${diff.slice(0, 10000)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Commit Message Gen Error:", error);
    return "";
  }
};
