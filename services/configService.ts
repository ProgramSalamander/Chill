
import { AIConfig, AIModelProfile } from '../types';

const generateId = () => Math.random().toString(36).slice(2, 11);

const DEFAULT_PROFILE_ID = 'default-gemini-flash';
const DEFAULT_CONFIG: AIConfig = {
  profiles: [{
    id: DEFAULT_PROFILE_ID,
    name: 'Default Gemini Flash',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    baseUrl: '',
    apiKey: ''
  }],
  activeChatProfileId: DEFAULT_PROFILE_ID,
  activeCompletionProfileId: DEFAULT_PROFILE_ID,
};

let _configCache: AIConfig | null = null;

// Helper to migrate from the old { chat: ..., completion: ... } structure
const migrateOldConfig = (oldConfig: any): AIConfig => {
    const chatProfile: AIModelProfile = {
        id: generateId(),
        name: 'Chat Model (Migrated)',
        provider: 'gemini', // default
        ...oldConfig.chat
    };
    const completionProfile: AIModelProfile = {
        id: generateId(),
        name: 'Completion Model (Migrated)',
        provider: 'gemini', // default
        ...oldConfig.completion
    };
    
    // If they are the same model, just create one profile
    if (JSON.stringify(oldConfig.chat) === JSON.stringify(oldConfig.completion)) {
        chatProfile.name = 'Default Model (Migrated)';
        return {
            profiles: [chatProfile],
            activeChatProfileId: chatProfile.id,
            activeCompletionProfileId: chatProfile.id
        };
    }

    return {
        profiles: [chatProfile, completionProfile],
        activeChatProfileId: chatProfile.id,
        activeCompletionProfileId: completionProfile.id
    };
};


export const getAIConfig = (): AIConfig => {
  if (_configCache) return _configCache;
  
  try {
    const stored = localStorage.getItem('vibe_ai_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check for old structure and migrate if necessary
      if (parsed.chat && parsed.completion) {
          const migratedConfig = migrateOldConfig(parsed);
          saveAIConfig(migratedConfig);
          _configCache = migratedConfig;
          return _configCache;
      }
      _configCache = { 
          ...DEFAULT_CONFIG, 
          ...parsed,
          // Ensure profiles array always exists
          profiles: parsed.profiles && parsed.profiles.length > 0 ? parsed.profiles : [...DEFAULT_CONFIG.profiles]
      };
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

// Helper to get the active profile for chat
export const getActiveChatConfig = (): AIModelProfile | null => {
    const config = getAIConfig();
    if (!config.activeChatProfileId) return config.profiles[0] || null;
    return config.profiles.find(p => p.id === config.activeChatProfileId) || config.profiles[0] || null;
}

// Helper to get the active profile for completions
export const getActiveCompletionConfig = (): AIModelProfile | null => {
    const config = getAIConfig();
    if (!config.activeCompletionProfileId) return config.profiles[0] || null;
    return config.profiles.find(p => p.id === config.activeCompletionProfileId) || config.profiles[0] || null;
}
