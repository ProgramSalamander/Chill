import React, { useEffect, useState } from 'react';
import { IconClose, IconSettings, IconSparkles, IconTerminal, IconPlus, IconTrash, IconList, IconCheckCircle, IconZap } from './Icons';
import { AIConfig, AIModelProfile } from '../types';
import { getAIConfig, saveAIConfig } from '../services/configService';
import { useUIStore } from '../stores/uiStore';
import { useChatStore } from '../stores/chatStore';

const generateId = () => Math.random().toString(36).slice(2, 11);

const SettingsModal: React.FC = () => {
  const [config, setConfig] = useState<AIConfig>(getAIConfig());
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(config.activeChatProfileId || (config.profiles[0]?.id || null));
  const [hasSystemKey, setHasSystemKey] = useState(false);

  const isSettingsOpen = useUIStore(state => state.isSettingsOpen);
  const setIsSettingsOpen = useUIStore(state => state.setIsSettingsOpen);
  const initChat = useChatStore(state => state.initChat);

  useEffect(() => {
    if (isSettingsOpen) {
      const currentConfig = getAIConfig();
      setConfig(currentConfig);
      setSelectedProfileId(currentConfig.activeChatProfileId || (currentConfig.profiles[0]?.id || null));
      checkKey();
    }
  }, [isSettingsOpen]);

  const checkKey = async () => {
    if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasSystemKey(has);
    }
  };

  const handleSave = () => {
      saveAIConfig(config);
      initChat();
      setIsSettingsOpen(false);
  };

  const updateSelectedProfile = (key: keyof AIModelProfile, value: string) => {
      setConfig(prev => ({
          ...prev,
          profiles: prev.profiles.map(p => p.id === selectedProfileId ? { ...p, [key]: value } : p)
      }));
  };

  const handleNewProfile = () => {
      const newProfile: AIModelProfile = {
          id: generateId(),
          name: 'New Profile',
          provider: 'gemini',
          modelId: 'gemini-2.5-flash',
          baseUrl: '',
          apiKey: ''
      };
      setConfig(prev => ({
          ...prev,
          profiles: [...prev.profiles, newProfile]
      }));
      setSelectedProfileId(newProfile.id);
  };

  const handleDeleteProfile = (id: string) => {
      if (config.profiles.length <= 1) {
          alert("Cannot delete the last profile.");
          return;
      }
      setConfig(prev => {
          const newProfiles = prev.profiles.filter(p => p.id !== id);
          const newActiveChat = prev.activeChatProfileId === id ? newProfiles[0].id : prev.activeChatProfileId;
          const newActiveCompletion = prev.activeCompletionProfileId === id ? newProfiles[0].id : prev.activeCompletionProfileId;
          if(selectedProfileId === id) {
              setSelectedProfileId(newActiveChat);
          }
          return {
              profiles: newProfiles,
              activeChatProfileId: newActiveChat,
              activeCompletionProfileId: newActiveCompletion
          }
      });
  };

  if (!isSettingsOpen) return null;

  const selectedProfile = config.profiles.find(p => p.id === selectedProfileId);
  const isGemini = selectedProfile?.provider === 'gemini';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[700px] max-w-[95vw] bg-[#0f0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
               <IconSettings size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">AI Settings</h2>
          </div>
          <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors p-1"><IconClose size={18} /></button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar with Profiles */}
            <div className="w-1/3 min-w-[200px] bg-black/20 border-r border-white/5 flex flex-col">
                <div className="p-3 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <IconList size={12}/> Model Profiles
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {config.profiles.map(p => (
                        <button 
                            key={p.id}
                            onClick={() => setSelectedProfileId(p.id)}
                            className={`w-full text-left p-2 rounded-lg transition-colors group flex items-start justify-between ${selectedProfileId === p.id ? 'bg-vibe-accent/20' : 'hover:bg-white/5'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${selectedProfileId === p.id ? 'text-white' : 'text-slate-300'}`}>{p.name}</p>
                                <p className="text-xs text-slate-500 font-mono truncate">{p.modelId}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash size={12}/></button>
                        </button>
                    ))}
                </div>
                <div className="p-2 border-t border-white/5">
                    <button onClick={handleNewProfile} className="w-full py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                        <IconPlus size={14}/> Add Profile
                    </button>
                </div>
            </div>

            {/* Form Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {!selectedProfile ? (
                    <div className="text-slate-600 text-center py-10">Select or create a profile</div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-500 uppercase">Profile Name</label>
                           <input type="text" value={selectedProfile.name} onChange={(e) => updateSelectedProfile('name', e.target.value)} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent"/>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-500 uppercase">Provider</label>
                           <div className="grid grid-cols-2 gap-2">
                               <button onClick={() => updateSelectedProfile('provider', 'gemini')} className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${isGemini ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}><IconSparkles size={14} /> Google Gemini</button>
                               <button onClick={() => updateSelectedProfile('provider', 'openai')} className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${!isGemini ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}><IconTerminal size={14} /> OpenAI / Compatible</button>
                           </div>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5"><label className="text-xs text-slate-400">Model ID</label><input type="text" value={selectedProfile.modelId} onChange={(e) => updateSelectedProfile('modelId', e.target.value)} placeholder={isGemini ? "gemini-2.5-flash" : "gpt-4o"} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent"/></div>
                            {!isGemini && (<div className="space-y-1.5"><label className="text-xs text-slate-400">Base URL</label><input type="text" value={selectedProfile.baseUrl} onChange={(e) => updateSelectedProfile('baseUrl', e.target.value)} placeholder="https://api.openai.com/v1" className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent"/><p className="text-[10px] text-slate-600">For LocalAI, Ollama, etc. use http://localhost:11434/v1</p></div>)}
                            <div className="space-y-1.5"><label className="text-xs text-slate-400">API Key</label><input type="password" value={selectedProfile.apiKey} onChange={(e) => updateSelectedProfile('apiKey', e.target.value)} placeholder={isGemini ? (hasSystemKey ? "Using System Key (Optional Override)" : "Required") : "sk-..."} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent"/></div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-white/5">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase">Set as Active</h4>
                            <div className="flex gap-2">
                                <button onClick={() => setConfig(c => ({...c, activeChatProfileId: selectedProfile.id}))} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold transition-all ${config.activeChatProfileId === selectedProfile.id ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'}`}>
                                    {config.activeChatProfileId === selectedProfile.id && <IconCheckCircle size={14} />}
                                    Chat & Agent
                                </button>
                                <button onClick={() => setConfig(c => ({...c, activeCompletionProfileId: selectedProfile.id}))} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold transition-all ${config.activeCompletionProfileId === selectedProfile.id ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'}`}>
                                    {config.activeCompletionProfileId === selectedProfile.id && <IconCheckCircle size={14} />}
                                    Inline Completion
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3 shrink-0">
          <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 rounded-lg text-sm font-medium bg-vibe-accent hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;