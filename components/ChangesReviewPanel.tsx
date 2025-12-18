
import React from 'react';
import { useAgentStore } from '../stores/agentStore';
import { useFileTreeStore } from '../stores/fileStore';
import { IconSparkles } from './Icons';

const ChangeFileListItem: React.FC<{ 
    label: string; 
    onClick: () => void;
}> = ({ label, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="flex w-full items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-all text-left group"
    >
      <span className="text-vibe-glow group-hover:scale-110 transition-transform"><IconSparkles size={14}/></span>
      <span className="text-xs font-mono text-slate-300 truncate group-hover:text-white" title={label}>{label}</span>
    </button>
  );
};


const ChangesReviewPanel: React.FC = () => {
    const { patches, applyAllChanges, rejectAllChanges } = useAgentStore();
    const { files, selectFile } = useFileTreeStore();

    const handleSelectFile = (fileId: string) => {
        const file = files.find(f => f.id === fileId);
        if (file) {
            selectFile(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-vibe-900/50">
            <div className="p-4 border-b border-white/5 shrink-0 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-3">
                    <IconSparkles size={16} className="text-vibe-glow" />
                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        AI Proposals ({patches.length})
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                       onClick={() => rejectAllChanges()}
                       disabled={patches.length === 0}
                       className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-30 transition-all"
                    >
                        Reject All
                    </button>
                    <button 
                       onClick={() => applyAllChanges()}
                       disabled={patches.length === 0}
                       className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-30 transition-all"
                    >
                        Apply All
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-4">
                {patches.length > 0 ? (
                    <div>
                        <div className="px-2 mb-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">In-file Patches</div>
                        {patches.map(patch => {
                            const file = files.find(f => f.id === patch.fileId);
                            return (
                                <ChangeFileListItem 
                                    key={patch.id} 
                                    label={file?.name || 'Unknown File'} 
                                    onClick={() => handleSelectFile(patch.fileId)} 
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 opacity-20">
                            <IconSparkles size={24} />
                        </div>
                        <p className="text-xs text-slate-500 italic">No pending patches</p>
                    </div>
                )}
            </div>
            
            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                    Proposals are visual overlays. Click a file to review and <strong>Keep</strong> or <strong>Reject</strong> changes directly in the editor.
                </p>
            </div>
        </div>
    );
};

export default ChangesReviewPanel;