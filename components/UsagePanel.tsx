import React from 'react';
import { useUsageStore } from '../stores/usageStore';
import { IconActivity, IconZap, IconCpu, IconRefresh, IconClock, IconBrain } from './Icons';
import Tooltip from './Tooltip';

const UsageStatCard: React.FC<{ 
    label: string, 
    value: string | number, 
    icon: React.ReactNode, 
    colorClass: string 
}> = ({ label, value, icon, colorClass }) => (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-white/10 group">
        <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 shadow-lg group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-xl font-black text-white tracking-tight">{value}</p>
        </div>
    </div>
);

const UsagePanel: React.FC = () => {
  const { 
    totalInputTokens, 
    totalOutputTokens, 
    totalThinkingTokens, 
    totalApiCalls, 
    history, 
    modelBreakdown,
    resetStats 
  } = useUsageStore();

  const formatTokens = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val;
  };

  const totalTokens = totalInputTokens + totalOutputTokens;

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-left-4">
      <div className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5 flex justify-between items-center shrink-0">
        <span>Usage Analytics</span>
        <Tooltip content="Reset All Statistics" position="left">
            <button onClick={resetStats} className="text-slate-600 hover:text-red-400 transition-colors p-1 hover:bg-white/5 rounded-md">
                <IconRefresh size={14} />
            </button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 gap-4">
            <UsageStatCard 
                label="Total Tokens" 
                value={formatTokens(totalTokens)} 
                icon={<IconZap size={20} className="text-vibe-glow" />} 
                colorClass="bg-vibe-accent" 
            />
            <UsageStatCard 
                label="API Calls" 
                value={totalApiCalls} 
                icon={<IconActivity size={20} className="text-orange-400" />} 
                colorClass="bg-orange-500" 
            />
        </div>

        {/* Breakdown Card */}
        <div className="p-4 bg-black/20 border border-white/5 rounded-2xl space-y-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <IconBrain size={12} /> Model Distribution
            </h4>
            <div className="space-y-3">
                {Object.entries(modelBreakdown).length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No usage recorded yet.</p>
                // Fix: Explicitly cast entries to fix 'unknown' inference error for data.tokens
                ) : (Object.entries(modelBreakdown) as [string, { calls: number, tokens: number }][]).map(([model, data]) => (
                    <div key={model} className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                            <span className="font-mono text-slate-400 truncate max-w-[140px]">{model}</span>
                            <span className="font-bold text-vibe-glow">{formatTokens(data.tokens)} tks</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-vibe-accent to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.3)] transition-all duration-1000"
                                style={{ width: `${Math.min(100, (data.tokens / (totalTokens || 1)) * 100)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Input</p>
                <p className="text-sm font-bold text-slate-200">{formatTokens(totalInputTokens)}</p>
            </div>
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Output</p>
                <p className="text-sm font-bold text-slate-200">{formatTokens(totalOutputTokens)}</p>
            </div>
            {totalThinkingTokens > 0 && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl col-span-2 flex justify-between items-center">
                    <p className="text-[9px] font-bold text-indigo-400 uppercase">Reasoning (Thinking)</p>
                    <p className="text-sm font-bold text-indigo-200">{formatTokens(totalThinkingTokens)}</p>
                </div>
            )}
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <IconClock size={12} /> Recent Activity
            </h4>
            <div className="space-y-2">
                {history.length === 0 ? (
                    <div className="py-8 text-center text-slate-600 opacity-50">
                        <IconActivity size={32} className="mx-auto mb-2" />
                        <p className="text-xs">History will appear here</p>
                    </div>
                ) : history.map(rec => (
                    <div key={rec.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between group hover:bg-white/[0.08] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold uppercase
                                ${rec.type === 'chat' ? 'bg-vibe-accent/20 text-vibe-glow' : 
                                  rec.type === 'agent' ? 'bg-orange-500/20 text-orange-400' : 
                                  'bg-purple-500/20 text-purple-400'}
                            `}>
                                {rec.type[0]}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-200 capitalize">{rec.type} Call</p>
                                <p className="text-[9px] text-slate-500 font-mono">{new Date(rec.timestamp).toLocaleTimeString()}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-slate-300">+{rec.tokens.totalTokenCount}</p>
                            <p className="text-[9px] text-slate-600 font-mono uppercase">{rec.provider}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
      
      <div className="p-4 bg-vibe-accent/5 border-t border-white/5 text-center">
         <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Usage data is stored locally in your browser.</p>
      </div>
    </div>
  );
};

export default UsagePanel;