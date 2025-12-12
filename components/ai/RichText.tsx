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
    p: ({ node, ...props }: any) => {
      // This is a fix for a known issue with react-markdown where it can wrap
      // block-level elements (like our custom CodeBlock which renders a div/pre)
      // inside a <p> tag, which is invalid HTML.
      // We check if the paragraph's only child is a non-inline code block.
      if (
        node &&
        node.children.length === 1 &&
        node.children[0].tagName === 'code'
      ) {
        // This paragraph only contains a code block.
        // It's likely a fenced code block that got wrapped, so we render its
        // children directly to avoid the invalid <p> wrapper.
        return <>{props.children}</>;
      }
      return <p className="my-2" {...props} />;
    },
    strong: ({node, ...props}: any) => <strong className="text-white font-bold" {...props} />,
    em: ({node, ...props}: any) => <em className="italic text-slate-300" {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-vibe-accent/50 pl-4 my-2 text-slate-400 italic" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-6 space-y-1 my-2" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-outside ml-6 space-y-1 my-2" {...props} />,
    hr: ({node, ...props}: any) => <hr className="border-white/10 my-4" {...props} />,
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      
      // Render our custom CodeBlock for fenced code blocks
      if (!inline) {
        return (
          <CodeBlock
            code={codeString}
            language={match ? match[1] : ''}
            onApply={onApplyCode}
            onInsert={onInsertCode}
          />
        );
      }
      
      // Render a styled inline code element
      return (
        <code className="bg-white/10 px-1 py-0.5 rounded text-vibe-glow font-mono text-[90%]" {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="text-sm leading-relaxed text-slate-300 space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default RichText;