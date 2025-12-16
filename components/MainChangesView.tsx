
import React from 'react';
import { useAgentStore } from '../stores/agentStore';
import ChangeItem from './ai/ChangeItem';
import { IconGitMerge } from './Icons';

const MainChangesView: React.FC = () => {
    const { stagedChanges } = useAgentStore();
    
    return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar p-4">
            {stagedChanges.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 animate-float shadow-xl backdrop-blur-sm">
                       <IconGitMerge size={40} className="text-vibe-glow opacity-60" />
                    </div>
                    <p className="text-sm font-medium tracking-wide">No staged changes from agent</p>
                    <p className="text-xs opacity-50">Run the agent to generate changes</p>
                </div>
            ) : (
                <div className="space-y-4 max-w-4xl mx-auto">
                   <h1 className="text-xl font-bold text-white mb-2">Agent Staged Changes</h1>
                   {stagedChanges.map(change => <ChangeItem key={change.id} change={change} />)}
                </div>
            )}
        </div>
    );
};

export default MainChangesView;
