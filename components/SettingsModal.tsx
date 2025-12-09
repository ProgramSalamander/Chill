import React, { useEffect, useState } from 'react';
import { IconClose, IconSettings, IconZap, IconCpu } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdate: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onKeyUpdate }) => {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkKey();
    }
  }, [isOpen]);

  const checkKey = async () => {
    if (window.aistudio) {
      try {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      } catch (e) {
        console.error("Error checking key status:", e);
      }
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Assuming success if the promise resolves without error in the provided environment
        setHasKey(true);
        onKeyUpdate();
      } catch (e) {
        console.error("Error selecting key:", e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[480px] bg-[#0f0f16] border border-indigo-500/20 rounded-2xl shadow-[0_0_50px_rgba(99,102,241,0.15)] overflow-hidden transform transition-all">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-900/20 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
               <IconSettings size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Configuration</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md"
          >
            <IconClose size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* API Key Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <IconCpu size={12} />
              AI Model Access
            </h3>
            
            <div className="p-1 rounded-xl bg-black/20 border border-white/5">
              <div className="bg-[#13131f] rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Gemini API Key</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {hasKey 
                        ? 'Connected with custom API key' 
                        : 'Using default system key'}
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border ${
                    hasKey 
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                      : 'bg-slate-800 border-white/5 text-slate-400'
                  }`}>
                    {hasKey ? 'CUSTOM KEY' : 'DEFAULT'}
                  </div>
                </div>

                <button 
                  onClick={handleSelectKey}
                  className="group relative w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-indigo-600/20 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <IconZap size={16} className={hasKey ? "fill-current" : ""} />
                  {hasKey ? 'Update API Key' : 'Select API Key'}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center leading-relaxed max-w-[90%] mx-auto">
              To verify and control your usage, select a project with a valid API key.
              <br />
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noreferrer" 
                className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
              >
                View Billing Documentation
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
          <button 
            onClick={onClose} 
            className="px-5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
