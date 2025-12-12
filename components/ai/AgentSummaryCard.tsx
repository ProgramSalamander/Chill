import React from 'react';
import { IconCheckCircle, IconFileCode, IconSparkles } from '../Icons';
import RichText from './RichText';

interface AgentSummaryCardProps {
  summaryText: string;
}

const AgentSummaryCard: React.FC<AgentSummaryCardProps> = ({ summaryText }) => {
  // Simple regex to find file paths or names in backticks
  const fileRegex = /`([^`]+(\.[a-zA-Z0-9]+))`|([\w/.-]+\.\w+)/g;
  const filesMentioned = [...new Set(Array.from(summaryText.matchAll(fileRegex), m => m[1] || m[3]))];
  const cleanSummary = summaryText.replace(/###\s*Summary/i, '').trim();

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-xl p-4 animate-in fade-in duration-500 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-500/10 border border-green-500/20 p-2 rounded-lg">
                    <IconCheckCircle size={20} className="text-green-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white">Task Completed</h3>
                    <p className="text-xs text-slate-400">The agent has finished the execution plan.</p>
                </div>
            </div>

            <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <IconSparkles size={14} className="text-vibe-glow"/>
                    AI Summary
                </h4>
                <div className="text-sm text-slate-300 leading-relaxed">
                   <RichText text={cleanSummary} />
                </div>
            </div>

            {filesMentioned.length > 0 && (
                 <div className="mt-4">
                     <h4 className="text-xs font-bold text-slate-400 mb-2">Files Modified/Created</h4>
                     <div className="flex flex-col gap-1.5">
                         {filesMentioned.map((file, i) => (
                             <div key={i} className="flex items-center gap-2 bg-white/5 p-1.5 rounded text-xs">
                                 <IconFileCode size={12} className="text-slate-500"/>
                                 <span className="font-mono text-slate-300">{file}</span>
                             </div>
                         ))}
                     </div>
                 </div>
            )}
        </div>
    </div>
  );
};

export default AgentSummaryCard;
