import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { IconBrain } from './Icons';

const StatusBar: React.FC = () => {
    const indexingProgress = useUIStore(state => state.indexingProgress);

    return (
        <div className="h-6 bg-vibe-900/80 backdrop-blur-sm border-t border-vibe-border flex items-center px-4 text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-4">
                {/* RAG Indexing Status */}
                {indexingProgress && (
                    <div className="flex items-center gap-2 text-vibe-glow animate-pulse">
                        <IconBrain size={12} />
                        <span>
                            Building Smart Context... ({indexingProgress.loaded}/{indexingProgress.total})
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-4">
                 <span className="font-mono text-[10px] text-slate-500">UTF-8</span>
                 <span className="font-mono text-[10px] text-slate-500">LF</span>
                 <span className="font-mono text-[10px] text-slate-500">VibeCode AI</span>
            </div>
        </div>
    );
};

export default StatusBar;
