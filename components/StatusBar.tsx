import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';
import { IconBrain, IconCheckCircle, IconGitBranch, IconArrowDown, IconRefresh } from './Icons';

const StatusBar: React.FC = () => {
    const indexingProgress = useUIStore(state => state.indexingProgress);
    const indexingStatus = useUIStore(state => state.indexingStatus);
    const { isCloning, isPulling, isFetching, cloneProgress } = useGitStore();

    const getIndexingContent = () => {
        if (indexingStatus === 'indexing') {
            const progressText = indexingProgress ? `(${indexingProgress.loaded}/${indexingProgress.total})` : '';
            return (
                <div className="flex items-center gap-2 text-vibe-glow animate-pulse">
                    <IconBrain size={12} />
                    <span>
                        Building smart context... {progressText}
                    </span>
                </div>
            );
        }
        if (indexingStatus === 'ready') {
            return (
                <div className="flex items-center gap-2 text-green-400">
                    <IconCheckCircle size={12} />
                    <span>
                        Smart context ready
                    </span>
                </div>
            );
        }
        return null;
    };

    const getGitStatusContent = () => {
        if (isCloning) {
            const progressText = cloneProgress?.total > 1 
                ? `${Math.round((cloneProgress.loaded / cloneProgress.total) * 100)}%`
                : '';
            return (
                <div className="flex items-center gap-2 text-vibe-glow">
                    <IconGitBranch size={12} className="animate-spin" />
                    <span>
                        Cloning... {cloneProgress?.phase} {progressText}
                    </span>
                </div>
            );
        }
        if (isPulling) {
            return (
                <div className="flex items-center gap-2 text-vibe-glow">
                    <IconArrowDown size={12} className="animate-bounce" />
                    <span>Pulling...</span>
                </div>
            );
        }
        if (isFetching) {
            return (
                <div className="flex items-center gap-2 text-vibe-glow">
                    <IconRefresh size={12} className="animate-spin" />
                    <span>Fetching...</span>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="h-6 bg-vibe-900/80 backdrop-blur-sm border-t border-vibe-border flex items-center px-4 text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-4">
                {/* Git Status */}
                {getGitStatusContent()}
                {/* RAG Indexing Status */}
                {getIndexingContent()}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-4">
                 <span className="font-mono text-[10px] text-slate-500">UTF-8</span>
                 <span className="font-mono text-[10px] text-slate-500">LF</span>
                 <span className="font-mono text-[10px] text-slate-500">Chill</span>
            </div>
        </div>
    );
};

export default StatusBar;