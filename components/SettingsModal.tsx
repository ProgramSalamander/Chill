
import React, { useEffect, useState } from 'react';
import { IconClose, IconSettings, IconZap, IconCpu, IconSparkles, IconTerminal } from './Icons';
import { AIConfig, AIModelConfig, AIProvider } from '../types';
import { getAIConfig, saveAIConfig } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdate: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onKeyUpdate }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'completion'>('chat');
  const [config, setConfig] = useState<AIConfig>(getAIConfig());
  const [hasSystemKey, setHasSystemKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getAIConfig());
      checkKey();
    }
  }, [isOpen]);

  const checkKey = async () => {
    if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasSystemKey(has);
    }
  };

  const handleSave = () => {
      saveAIConfig(config);
      onKeyUpdate();
      onClose();
  };

  const updateConfig = (section: 'chat' | 'completion', key: keyof AIModelConfig, value: string) => {
      setConfig(prev => ({
          ...prev,
          [section]: {
              ...prev[section],
              [key]: value
          }
      }));
  };

  if (!isOpen) return null;

  const renderConfigForm = (section: 'chat' | 'completion') => {
      const modelConfig = config[section];
      const isGemini = modelConfig.provider === 'gemini';

      return (
          <div className="space-y-4 animate-in fade-in duration-300">
             {/* Provider Select */}
             <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-slate-500 uppercase">Provider</label>
                 <div className="grid grid-cols-2 gap-2">
                     <button 
                        onClick={() => updateConfig(section, 'provider', 'gemini')}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${isGemini ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}
                     >
                         <IconSparkles size={14} />
                         Google Gemini
                     </button>
                     <button 
                        onClick={() => updateConfig(section, 'provider', 'openai')}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${!isGemini ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/5'}`}
                     >
                         <IconTerminal size={14} />
                         OpenAI / Compatible
                     </button>
                 </div>
             </div>

             {/* Fields */}
             <div className="space-y-3">
                 <div className="space-y-1.5">
                     <label className="text-xs text-slate-400">Model ID</label>
                     <input 
                        type="text" 
                        value={modelConfig.modelId}
                        onChange={(e) => updateConfig(section, 'modelId', e.target.value)}
                        placeholder={isGemini ? "gemini-2.5-flash" : "gpt-4o"}
                        className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent"
                     />
                 </div>
                 
                 {!isGemini && (
                     <div className="space-y-1.5">
                        <label className="text-xs text-slate-400">Base URL</label>
                        <input 
                            type="text" 
                            value={modelConfig.baseUrl}
                            onChange={(e) => updateConfig(section, 'baseUrl', e.target.value)}
                            placeholder="https://api.openai.com/v1"
                            className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent"
                        />
                        <p className="text-[10px] text-slate-600">For LocalAI, Ollama, etc. use http://localhost:11434/v1</p>
                    </div>
                 )}

                 <div className="space-y-1.5">
                     <label className="text-xs text-slate-400">API Key</label>
                     <input 
                        type="password" 
                        value={modelConfig.apiKey}
                        onChange={(e) => updateConfig(section, 'apiKey', e.target.value)}
                        placeholder={isGemini ? (hasSystemKey ? "Using System Key (Optional Override)" : "Required") : "sk-..."}
                        className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-vibe-accent"
                     />
                 </div>
             </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[500px] bg-[#0f0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
               <IconSettings size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">AI Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1"><IconClose size={18} /></button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-white/5">
             <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'chat' ? 'border-vibe-accent text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
             >
                 Chat & Agent
             </button>
             <button 
                onClick={() => setActiveTab('completion')}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'completion' ? 'border-vibe-accent text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
             >
                 Inline Completion
             </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
            {renderConfigForm(activeTab)}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-6 py-2 rounded-lg text-sm font-medium bg-vibe-accent hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
