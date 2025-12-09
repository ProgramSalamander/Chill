
import { AIConfig } from '../types';

const DEFAULT_CONFIG: AIConfig = {
  chat: {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    baseUrl: '',
    apiKey: ''
  },
  completion: {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    baseUrl: '',
    apiKey: ''
  }
};

let _configCache: AIConfig | null = null;

export const getAIConfig = (): AIConfig => {
  if (_configCache) return _configCache;
  
  try {
    const stored = localStorage.getItem('vibe_ai_config');
    if (stored) {
      _configCache = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      return _configCache!;
    }
  } catch (e) {
    console.error("Failed to load AI config", e);
  }
  
  _configCache = { ...DEFAULT_CONFIG };
  return _configCache;
};

export const saveAIConfig = (config: AIConfig) => {
  _configCache = config;
  localStorage.setItem('vibe_ai_config', JSON.stringify(config));
};
