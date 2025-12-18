
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AIUsageMetadata } from '../types';

interface UsageRecord {
    id: string;
    timestamp: number;
    modelId: string;
    provider: string;
    tokens: AIUsageMetadata;
    type: 'chat' | 'agent' | 'completion' | 'planning';
}

interface UsageState {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  totalApiCalls: number;
  history: UsageRecord[];
  modelBreakdown: Record<string, { calls: number, tokens: number }>;

  // Actions
  recordUsage: (modelId: string, provider: string, tokens: AIUsageMetadata, type: UsageRecord['type']) => void;
  resetStats: () => void;
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalThinkingTokens: 0,
      totalApiCalls: 0,
      history: [],
      modelBreakdown: {},

      recordUsage: (modelId, provider, tokens, type) => {
        const { totalInputTokens, totalOutputTokens, totalThinkingTokens, totalApiCalls, history, modelBreakdown } = get();
        
        const newRecord: UsageRecord = {
          id: Math.random().toString(36).slice(2, 11),
          timestamp: Date.now(),
          modelId,
          provider,
          tokens,
          type
        };

        const updatedBreakdown = { ...modelBreakdown };
        if (!updatedBreakdown[modelId]) {
            updatedBreakdown[modelId] = { calls: 0, tokens: 0 };
        }
        updatedBreakdown[modelId].calls += 1;
        updatedBreakdown[modelId].tokens += tokens.totalTokenCount;

        set({
          totalInputTokens: totalInputTokens + tokens.promptTokenCount,
          totalOutputTokens: totalOutputTokens + tokens.candidatesTokenCount,
          totalThinkingTokens: totalThinkingTokens + (tokens.thinkingTokenCount || 0),
          totalApiCalls: totalApiCalls + 1,
          history: [newRecord, ...history].slice(0, 100), // Keep last 100
          modelBreakdown: updatedBreakdown
        });
      },

      resetStats: () => set({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        totalApiCalls: 0,
        history: [],
        modelBreakdown: {}
      })
    }),
    {
      name: 'vibe-usage-storage',
    }
  )
);
