import React from 'react';

const RichText: React.FC<{ text: string }> = ({ text }) => {
    const parse = (input: string) => {
        const parts = [];
        let lastIndex = 0;
        const regex = /(\*\*.*?\*\*)|(`.*?`)|(^\s*-\s.*$)|(\*.*?\*)/gm;
        let match;

        while ((match = regex.exec(input)) !== null) {
            if (match.index > lastIndex) {
                parts.push(input.substring(lastIndex, match.index));
            }
            const fullMatch = match[0];
            if (fullMatch.startsWith('**')) {
                parts.push(<strong key={match.index} className="text-white font-bold">{fullMatch.slice(2, -2)}</strong>);
            } else if (fullMatch.startsWith('`')) {
                parts.push(<code key={match.index} className="bg-white/10 px-1 py-0.5 rounded text-vibe-glow font-mono text-[90%]">{fullMatch.slice(1, -1)}</code>);
            } else if (fullMatch.startsWith('*')) {
                parts.push(<em key={match.index} className="italic text-slate-300">{fullMatch.slice(1, -1)}</em>);
            } else if (fullMatch.trim().startsWith('-')) {
                 parts.push(<div key={match.index} className="flex gap-2 ml-2 my-1"><span className="text-vibe-accent">•</span><span>{fullMatch.replace(/^\s*-\s/, '')}</span></div>);
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < input.length) {
            parts.push(input.substring(lastIndex));
        }
        return parts;
    };

    const lines = text.split('\n');
    return (
        <div className="whitespace-pre-wrap leading-relaxed text-slate-300">
             {lines.map((line, i) => (
                 <React.Fragment key={i}>
                     {parse(line)}
                     {i < lines.length - 1 && '\n'}
                 </React.Fragment>
             ))}
        </div>
    );
};

export default RichText;
