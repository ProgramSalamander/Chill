import React from 'react';

// Inline parser for bold, italic, and inline code
const parseInline = (text: string) => {
    // FIX: Changed JSX.Element to React.JSX.Element to fix namespace issue.
    const parts: (string | React.JSX.Element)[] = [];
    let lastIndex = 0;
    const regex = /(\*\*.*?\*\*)|(\*.*?\*)|(`.*?`)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        const fullMatch = match[0];
        if (fullMatch.startsWith('**')) {
            parts.push(<strong key={match.index} className="text-white font-bold">{fullMatch.slice(2, -2)}</strong>);
        } else if (fullMatch.startsWith('*') && !fullMatch.startsWith('**')) {
            parts.push(<em key={match.index} className="italic text-slate-300">{fullMatch.slice(1, -1)}</em>);
        } else if (fullMatch.startsWith('`')) {
            parts.push(<code key={match.index} className="bg-white/10 px-1 py-0.5 rounded text-vibe-glow font-mono text-[90%]">{fullMatch.slice(1, -1)}</code>);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return <>{parts.map((p, i) => <React.Fragment key={i}>{p}</React.Fragment>)}</>;
};

const RichText: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: { type: 'ul' | 'ol', content: string }[] = [];
    let blockquoteLines: string[] = [];

    const flushBuffers = () => {
        if (listItems.length > 0) {
            const listType = listItems[0].type;
            // FIX: Using a variable for a tag name in JSX requires React.createElement.
            elements.push(
                React.createElement(listType, {
                    key: `list-${elements.length}`,
                    className: `${listType === 'ul' ? 'list-disc' : 'list-decimal'} list-outside ml-6 space-y-1 my-2`
                }, listItems.map((item, i) => (
                    <li key={i}>{parseInline(item.content)}</li>
                )))
            );
            listItems = [];
        }
        if (blockquoteLines.length > 0) {
            elements.push(
                <blockquote key={`bq-${elements.length}`} className="border-l-4 border-vibe-accent/50 pl-4 my-2 text-slate-400 italic">
                    {blockquoteLines.map((line, i) => (
                        <React.Fragment key={i}>
                            {parseInline(line)}
                            {i < blockquoteLines.length - 1 && <br />}
                        </React.Fragment>
                    ))}
                </blockquote>
            );
            blockquoteLines = [];
        }
    };

    lines.forEach((line, index) => {
        // Headings
        const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
        if (headingMatch) {
            flushBuffers();
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            // FIX: Changed JSX.IntrinsicElements to React.JSX.IntrinsicElements and used React.createElement for dynamic tag.
            const Tag = `h${level + 2}` as keyof React.JSX.IntrinsicElements;
            const sizeClass = ({ 1: 'text-xl', 2: 'text-lg', 3: 'text-base' } as const)[level as 1|2|3];
            elements.push(React.createElement(Tag, {
                key: index,
                className: `${sizeClass} font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10`
            }, parseInline(content)));
            return;
        }

        // Horizontal Rule
        if (line.match(/^(\*\*\*|---|- - -)$/)) {
            flushBuffers();
            elements.push(<hr key={index} className="border-white/10 my-4" />);
            return;
        }

        // Blockquotes
        const blockquoteMatch = line.match(/^>\s?(.*)/);
        if (blockquoteMatch) {
            if (listItems.length > 0) flushBuffers(); // Flush lists if we enter a blockquote
            blockquoteLines.push(blockquoteMatch[1]);
            return;
        }

        // Unordered List
        const ulMatch = line.match(/^\s*[-*]\s+(.*)/);
        if (ulMatch) {
            if (blockquoteLines.length > 0) flushBuffers(); // Flush blockquotes
            if (listItems.length > 0 && listItems[0].type !== 'ul') flushBuffers();
            listItems.push({ type: 'ul', content: ulMatch[1] });
            return;
        }
        
        // Ordered List
        const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
        if (olMatch) {
            if (blockquoteLines.length > 0) flushBuffers();
            if (listItems.length > 0 && listItems[0].type !== 'ol') flushBuffers();
            listItems.push({ type: 'ol', content: olMatch[1] });
            return;
        }

        // If we reach here, the line is not a special block element.
        flushBuffers();
        
        if (line.trim().length > 0) {
            elements.push(<p key={index}>{parseInline(line)}</p>);
        }
    });

    flushBuffers(); // Flush any remaining buffers at the end

    return (
        <div className="text-sm leading-relaxed text-slate-300 space-y-3">
             {elements}
        </div>
    );
};

export default RichText;