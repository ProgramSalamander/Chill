
import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';
import { useLinterStore, availableLinters } from '../stores/linterStore';
import { IconBrain, IconCheckCircle, IconGitBranch, IconArrowDown, IconRefresh, IconBug } from './Icons';

const StatusBar: React.FC = () => {
    const indexingProgress = useUIStore(state => state.indexingProgress);
    const indexingStatus = useUIStore(state => state.indexingStatus);
    const { isCloning, isPulling, isFetching, cloneProgress } = useGitStore();
    const linterStatuses = useLinterStore(state => state.linterStatuses);

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

    const getLinterStatusContent = () => {
        const activeLinters = availableLinters.filter(l => linterStatuses[l.id] === 'initializing' || linterStatuses[l.id] === 'ready');
        
        return activeLinters.map(l => {
            const status = linterStatuses[l.id];
            if (status === 'initializing') {
                return (
                    <div key={l.id} className="flex items-center gap-2 text-amber-400 animate-pulse">
                        <IconBug size={12} className="animate-spin-slow" />
                        <span>Initializing {l.name}...</span>
                    </div>
                );
            }
            if (status === 'ready') {
                return (
                    <div key={l.id} className="flex items-center gap-2 text-slate-500 opacity-80 group hover:opacity-100 transition-opacity">
                        <IconBug size={12} className="text-green-500/50 group-hover:text-green-500 transition-colors" />
                        <span>{l.name} Ready</span>
                    </div>
                );
            }
            return null;
        });
    };

    return (
        <div className="h-6 bg-vibe-900/80 backdrop-blur-sm border-t border-vibe-border flex items-center px-4 text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-4 overflow-hidden">
                {/* Git Status */}
                {getGitStatusContent()}
                {/* RAG Indexing Status */}
                {getIndexingContent()}
                {/* Linter Status */}
                {getLinterStatusContent()}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-4 shrink-0">
                 <span className="font-mono text-[10px] text-slate-500">UTF-8</span>
                 <span className="font-mono text-[10px] text-slate-500">LF</span>
                 <span className="font-mono text-[10px] text-slate-500 tracking-wider font-bold">CHILL IDE</span>
            </div>
        </div>
    );
};

export default StatusBar;
