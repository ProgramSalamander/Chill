
import React, { useMemo } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';
import { useFileTreeStore } from '../stores/fileStore';
import { useProjectStore } from '../stores/projectStore';
import { useLinterStore, availableLinters } from '../stores/linterStore';
import { 
  IconBrain, 
  IconCheckCircle, 
  IconGitBranch, 
  IconArrowDown, 
  IconRefresh, 
  IconBug,
  IconArrowUp,
  IconAlert
} from './Icons';

const StatusBar: React.FC = () => {
    // UI Store Selectors
    const indexingProgress = useUIStore(state => state.indexingProgress);
    const indexingStatus = useUIStore(state => state.indexingStatus);
    
    // Git Store Selectors
    const isCloning = useGitStore(state => state.isCloning);
    const isPulling = useGitStore(state => state.isPulling);
    const isFetching = useGitStore(state => state.isFetching);
    const isPushing = useGitStore(state => state.isPushing);
    const cloneProgress = useGitStore(state => state.cloneProgress);
    const isGitInitialized = useGitStore(state => state.isInitialized);

    // File Store Selectors
    const activeFileId = useFileTreeStore(state => state.activeFileId);
    const files = useFileTreeStore(state => state.files);
    
    // Project Store Selectors
    const activeProject = useProjectStore(state => state.activeProject);

    // Linter Store Selectors
    const linterStatuses = useLinterStore(state => state.linterStatuses);

    const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);

    const getIndexingContent = () => {
        if (indexingStatus === 'indexing') {
            const progressText = indexingProgress ? `(${indexingProgress.loaded}/${indexingProgress.total})` : '';
            return (
                <div className="flex items-center gap-1.5 text-vibe-glow animate-pulse">
                    <IconBrain size={12} />
                    <span className="truncate max-w-[150px]">
                        Indexing context... {progressText}
                    </span>
                </div>
            );
        }
        if (indexingStatus === 'ready') {
            return (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 opacity-80 hover:opacity-100 transition-opacity">
                    <IconCheckCircle size={12} />
                    <span className="hidden sm:inline">Context Ready</span>
                </div>
            );
        }
        return null;
    };

    const getGitStatusContent = () => {
        if (isCloning) {
            const progressText = cloneProgress?.total && cloneProgress.total > 1 
                ? `${Math.round((cloneProgress.loaded / cloneProgress.total) * 100)}%`
                : '';
            return (
                <div className="flex items-center gap-1.5 text-vibe-glow">
                    <IconGitBranch size={12} className="animate-spin" />
                    <span>Cloning... {cloneProgress?.phase} {progressText}</span>
                </div>
            );
        }
        if (isPulling) {
            return (
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <IconArrowDown size={12} className="animate-bounce" />
                    <span>Pulling...</span>
                </div>
            );
        }
        if (isPushing) {
            return (
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <IconArrowUp size={12} className="animate-bounce" />
                    <span>Pushing...</span>
                </div>
            );
        }
        if (isFetching) {
            return (
                <div className="flex items-center gap-1.5 text-vibe-text-soft">
                    <IconRefresh size={12} className="animate-spin" />
                    <span className="hidden sm:inline">Fetching...</span>
                </div>
            );
        }
        return null;
    };

    const getLinterStatusContent = () => {
        const activeLinters = availableLinters.filter(l => linterStatuses[l.id] === 'initializing' || linterStatuses[l.id] === 'ready' || linterStatuses[l.id] === 'error');
        
        if (activeLinters.length === 0) return null;

        return (
            <div className="flex items-center gap-3 border-l border-vibe-border pl-3 ml-1">
                {activeLinters.map(l => {
                    const status = linterStatuses[l.id];
                    if (status === 'initializing') {
                        return (
                            <div key={l.id} className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 animate-pulse" title={`${l.name}: Initializing`}>
                                <IconBug size={12} className="animate-spin-slow" />
                                <span className="hidden md:inline">{l.name}</span>
                            </div>
                        );
                    }
                    if (status === 'error') {
                        return (
                            <div key={l.id} className="flex items-center gap-1.5 text-red-600 dark:text-red-400" title={`${l.name}: Failed to start`}>
                                <IconAlert size={12} />
                                <span className="hidden md:inline">{l.name}</span>
                            </div>
                        );
                    }
                    if (status === 'ready') {
                        return (
                            <div key={l.id} className="flex items-center gap-1.5 text-vibe-text-soft opacity-60 hover:opacity-100 transition-opacity" title={`${l.name}: Ready`}>
                                <IconCheckCircle size={12} className="text-green-600 dark:text-green-500/80" />
                                <span className="hidden md:inline">{l.name}</span>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    return (
        <div className="h-7 bg-vibe-900 border-t border-vibe-border flex items-center px-3 text-[10px] text-vibe-text-soft font-medium select-none z-30 shrink-0">
            {/* Left Section: App Status & Git */}
            <div className="flex items-center gap-4 overflow-hidden flex-1">
                {/* Git Branch Info */}
                <div className="flex items-center gap-1.5 hover:text-vibe-text-main transition-colors cursor-pointer group">
                    <IconGitBranch size={12} className={isGitInitialized ? "text-vibe-accent group-hover:text-vibe-glow" : "text-vibe-text-muted"} />
                    <span>{isGitInitialized ? 'main' : 'local'}</span>
                    {!isGitInitialized && <span className="hidden sm:inline opacity-50 italic">- git not init</span>}
                </div>

                {/* Status Indicators */}
                {getGitStatusContent()}
                {getIndexingContent()}
                {getLinterStatusContent()}
            </div>

            {/* Right Section: File Context */}
            <div className="flex items-center gap-4 shrink-0">
                 {activeFile && (
                     <div className="flex items-center gap-3">
                        <span className="text-vibe-text-muted hidden sm:inline" title="File Language">
                            {activeFile.language === 'typescript' ? 'TypeScript' : 
                             activeFile.language === 'javascript' ? 'JavaScript' : 
                             activeFile.language === 'python' ? 'Python' : 
                             activeFile.language === 'markdown' ? 'Markdown' :
                             activeFile.language === 'json' ? 'JSON' :
                             activeFile.language === 'css' ? 'CSS' : 
                             activeFile.language === 'html' ? 'HTML' : 'Plain Text'}
                        </span>
                     </div>
                 )}
                 
                 <div className="h-3 w-px bg-vibe-border hidden sm:block"></div>

                 <div className="flex items-center gap-3 hidden sm:flex">
                    <span title="Encoding">UTF-8</span>
                    <span title="Indentation">Spaces: 2</span>
                 </div>

                 {activeProject && (
                    <div className="flex items-center gap-2 pl-3 border-l border-vibe-border ml-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        <span className="text-vibe-text-main max-w-[100px] truncate" title={`Project: ${activeProject.name}`}>{activeProject.name}</span>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default StatusBar;
