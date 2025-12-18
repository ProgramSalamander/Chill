
import React, { useEffect, useState } from 'react';
import { IconClose, IconSettings, IconSparkles, IconTerminal, IconPlus, IconTrash, IconList, IconCheckCircle, IconZap, IconCpu, IconLayout } from './Icons';
import { AIConfig, AIModelProfile } from '../types';
import { getAIConfig, saveAIConfig } from '../services/configService';
import { useUIStore } from '../stores/uiStore';
import { useChatStore } from '../stores/chatStore';

const generateId = () => Math.random().toString(36).slice(2, 11);

const SettingsModal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'features'>('profiles');
  const [config, setConfig] = useState<AIConfig>(getAIConfig());
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(config.activeChatProfileId || (config.profiles[0]?.id || null));
  const [hasSystemKey, setHasSystemKey] = useState(false);

  const isSettingsOpen = useUIStore(state => state.isSettingsOpen);
  const setIsSettingsOpen = useUIStore(state => state.setIsSettingsOpen);
  
  const inlineCompletionsEnabled = useUIStore(state => state.inlineCompletionsEnabled);
  const setInlineCompletionsEnabled = useUIStore(state => state.setInlineCompletionsEnabled);
  const disabledInlineLanguages = useUIStore(state => state.disabledInlineLanguages);
  const setDisabledInlineLanguages = useUIStore(state => state.setDisabledInlineLanguages);

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
          modelId: 'gemini-3-flash-preview',
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

  const toggleLanguage = (lang: string) => {
      if (disabledInlineLanguages.includes(lang)) {
          setDisabledInlineLanguages(disabledInlineLanguages.filter(l => l !== lang));
      } else {
          setDisabledInlineLanguages([...disabledInlineLanguages, lang]);
      }
  };

  if (!isSettingsOpen) return null;

  const selectedProfile = config.profiles.find(p => p.id === selectedProfileId);
  const isGemini = selectedProfile?.provider === 'gemini';

  const commonLangs = ['typescript', 'javascript', 'python', 'html', 'css', 'markdown', 'json'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[750px] max-w-[95vw] bg-[#0f0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
               <IconSettings size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Vibe Settings</h2>
          </div>
          <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors p-1"><IconClose size={18} /></button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-1/3 min-w-[220px] bg-black/20 border-r border-white/5 flex flex-col">
                <div className="p-2 space-y-1">
                    <button 
                        onClick={() => setActiveTab('features')}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${activeTab === 'features' ? 'bg-vibe-accent/20 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                    >
                        <IconZap size={16} />
                        <span className="text-sm font-semibold">AI Features</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('profiles')}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${activeTab === 'profiles' ? 'bg-vibe-accent/20 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                    >
                        <IconCpu size={16} />
                        <span className="text-sm font-semibold">Model Profiles</span>
                    </button>
                </div>

                {activeTab === 'profiles' && (
                    <>
                        <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-t border-white/5 mt-2">
                            <IconList size={12}/> Profiles
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {config.profiles.map(p => (
                                <div 
                                    key={p.id}
                                    onClick={() => setSelectedProfileId(p.id)}
                                    className={`w-full text-left p-2 rounded-lg transition-colors group flex items-start justify-between cursor-pointer ${selectedProfileId === p.id ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${selectedProfileId === p.id ? 'text-vibe-glow' : 'text-slate-300'}`}>{p.name}</p>
                                        <p className="text-[10px] text-slate-500 font-mono truncate opacity-60 uppercase tracking-tighter">{p.provider} • {p.modelId}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash size={12}/></button>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t border-white/5">
                            <button onClick={handleNewProfile} className="w-full py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-vibe-accent hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all">
                                <IconPlus size={14}/> Add Profile
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                {activeTab === 'features' ? (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-white">Inline Ghost Text</h3>
                                    <p className="text-xs text-slate-500 mt-1">Get predictive AI code suggestions as you type.</p>
                                </div>
                                <button 
                                    onClick={() => setInlineCompletionsEnabled(!inlineCompletionsEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${inlineCompletionsEnabled ? 'bg-vibe-accent' : 'bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${inlineCompletionsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {inlineCompletionsEnabled && (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4 animate-in slide-in-from-top-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Disable for Specific Languages</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {commonLangs.map(lang => (
                                            <button 
                                                key={lang}
                                                onClick={() => toggleLanguage(lang)}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${disabledInlineLanguages.includes(lang) ? 'bg-red-500/20 border-red-500/30 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic">Toggle languages to exclude them from automatic ghost text generation.</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-white/5 space-y-4">
                            <h3 className="text-base font-bold text-white">Other Features</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 opacity-50 grayscale flex flex-col items-center justify-center text-center">
                                    <IconSparkles size={24} className="text-vibe-glow mb-2" />
                                    <span className="text-xs font-bold text-slate-300">Auto-Lint Fixes</span>
                                    <span className="text-[9px] text-slate-500 uppercase mt-1">Coming Soon</span>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 opacity-50 grayscale flex flex-col items-center justify-center text-center">
                                    <IconLayout size={24} className="text-indigo-400 mb-2" />
                                    <span className="text-xs font-bold text-slate-300">Custom Tooling</span>
                                    <span className="text-[9px] text-slate-500 uppercase mt-1">Coming Soon</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : !selectedProfile ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                        <IconCpu size={48} className="opacity-20 mb-4" />
                        <p className="text-sm italic">Select a profile to configure models</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Profile Name</label>
                           <input type="text" value={selectedProfile.name} onChange={(e) => updateSelectedProfile('name', e.target.value)} className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-vibe-accent shadow-inner transition-all"/>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Provider</label>
                           <div className="grid grid-cols-2 gap-2">
                               <button onClick={() => updateSelectedProfile('provider', 'gemini')} className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${isGemini ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-lg shadow-indigo-500/10' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}><IconSparkles size={14} /> Google Gemini</button>
                               <button onClick={() => updateSelectedProfile('provider', 'openai')} className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${!isGemini ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-lg shadow-green-500/10' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}><IconTerminal size={14} /> OpenAI / Generic</button>
                           </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="space-y-1.5"><label className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Model ID</label><input type="text" value={selectedProfile.modelId} onChange={(e) => updateSelectedProfile('modelId', e.target.value)} placeholder={isGemini ? "gemini-3-flash-preview" : "gpt-4o"} className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent font-mono"/></div>
                            {!isGemini && (<div className="space-y-1.5"><label className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Base URL</label><input type="text" value={selectedProfile.baseUrl} onChange={(e) => updateSelectedProfile('baseUrl', e.target.value)} placeholder="https://api.openai.com/v1" className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent font-mono"/><p className="text-[10px] text-slate-600 mt-1">For local providers like Ollama, use http://localhost:11434/v1</p></div>)}
                            <div className="space-y-1.5"><label className="text-xs text-slate-500 uppercase font-bold tracking-tighter">API Key</label><input type="password" value={selectedProfile.apiKey} onChange={(e) => updateSelectedProfile('apiKey', e.target.value)} placeholder={isGemini ? (hasSystemKey ? "Using System Key (Optional Override)" : "Required") : "sk-..."} className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent font-mono"/></div>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-white/5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Roles</h4>
                            <div className="flex gap-2">
                                <button onClick={() => setConfig(c => ({...c, activeChatProfileId: selectedProfile.id}))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${config.activeChatProfileId === selectedProfile.id ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-lg' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}>
                                    {config.activeChatProfileId === selectedProfile.id && <IconCheckCircle size={14} />}
                                    Chat & Agent
                                </button>
                                <button onClick={() => setConfig(c => ({...c, activeCompletionProfileId: selectedProfile.id}))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${config.activeCompletionProfileId === selectedProfile.id ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-lg' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}>
                                    {config.activeCompletionProfileId === selectedProfile.id && <IconCheckCircle size={14} />}
                                    Ghost Text
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-white/5 border-t border-white/5 flex justify-end gap-3 shrink-0">
          <button onClick={() => setIsSettingsOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-8 py-2 rounded-xl text-sm font-bold bg-vibe-accent hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 transition-all transform hover:scale-105 active:scale-95">Save Vibe</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
