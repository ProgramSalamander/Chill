import React from 'react';
import RichText from './RichText';

interface AgentSummaryCardProps {
  summaryText: string;
}

const AgentSummaryCard: React.FC<AgentSummaryCardProps> = ({ summaryText }) => {
  const cleanSummary = summaryText.replace(/###\s*Summary/i, '').trim();

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
            <div className="text-sm text-slate-300 leading-relaxed">
               <RichText text={cleanSummary} onApplyCode={() => {}} onInsertCode={() => {}} />
            </div>
        </div>
    </div>
  );
};

export default AgentSummaryCard;
