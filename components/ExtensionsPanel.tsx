import React from 'react';
import { useLinterStore, availableLinters } from '../stores/linterStore';
import { IconCheckCircle } from './Icons';

const ExtensionsPanel: React.FC = () => {
  const { installedLinters, installLinter, uninstallLinter } = useLinterStore();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5 shrink-0">
        <span>Extensions Marketplace</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <div className="text-xs text-slate-400 p-2 mb-2">Linters</div>
        {availableLinters.map((linter) => {
          const isInstalled = installedLinters.has(linter.id);
          return (
            <div key={linter.id} className="p-3 mb-2 bg-white/[.02] rounded-lg border border-transparent hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">{linter.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{linter.description}</p>
                </div>
                {isInstalled ? (
                  <button 
                    onClick={() => uninstallLinter(linter.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-300 transition-colors shrink-0 ml-4"
                  >
                    Uninstall
                  </button>
                ) : (
                  <button 
                    onClick={() => installLinter(linter.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-vibe-accent/20 text-vibe-glow hover:bg-vibe-accent/30 transition-colors shrink-0 ml-4"
                  >
                    Install
                  </button>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {linter.supportedLanguages.map(lang => (
                    <span key={lang} className="text-[9px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-slate-400">
                      {lang}
                    </span>
                  ))}
                </div>
                {isInstalled && (
                  <div className="flex items-center gap-1 text-green-500 text-xs">
                    <IconCheckCircle size={12} />
                    <span>Enabled</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExtensionsPanel;
