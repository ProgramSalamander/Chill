import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

interface RichTextProps {
  text: string;
  onApplyCode: (code: string) => void;
  onInsertCode: (code: string) => void;
}

const RichText: React.FC<RichTextProps> = ({ text, onApplyCode, onInsertCode }) => {
  const components = {
    h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10" {...props} />,
    p: ({node, ...props}: any) => <p className="my-2" {...props} />,
    strong: ({node, ...props}: any) => <strong className="text-white font-bold" {...props} />,
    em: ({node, ...props}: any) => <em className="italic text-slate-300" {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-vibe-accent/50 pl-4 my-2 text-slate-400 italic" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-6 space-y-1 my-2" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-outside ml-6 space-y-1 my-2" {...props} />,
    hr: ({node, ...props}: any) => <hr className="border-white/10 my-4" {...props} />,
    // This now only handles inline code.
    code({ node, inline, className, children, ...props }: any) {
      return (
        <code className="bg-white/10 px-1 py-0.5 rounded text-vibe-glow font-mono text-[90%]" {...props}>
          {children}
        </code>
      );
    }
  };

  // Split the text by fenced code blocks. The capturing group in split includes the delimiters.
  const codeBlockRegex = /(```(?:[a-zA-Z0-9_.-]+)?\n[\s\S]*?\n```)/g;
  const parts = text.split(codeBlockRegex).filter(part => part);

  return (
    <div className="text-sm leading-relaxed text-slate-300 space-y-3 prose-p:my-0">
      {parts.map((part, index) => {
        // Check if the part is a code block
        const codeBlockMatch = part.match(/^```([a-zA-Z0-9_.-]+)?\n([\s\S]*?)\n```$/);

        if (codeBlockMatch) {
          const language = codeBlockMatch[1] || '';
          const code = codeBlockMatch[2];
          return (
            <CodeBlock
              key={index}
              code={code}
              language={language}
              onApply={onApplyCode}
              onInsert={onInsertCode}
            />
          );
        } else if (part.trim()) {
          // It's a regular markdown part.
          return (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {part}
            </ReactMarkdown>
          );
        }
        return null;
      })}
    </div>
  );
};

export default RichText;
