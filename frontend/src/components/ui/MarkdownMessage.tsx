import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ──────────────────────────────────────────────────
// CodeBlock – handles fenced (multi-line) & inline
// ──────────────────────────────────────────────────
const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const codeString = String(children).replace(/\n$/, '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Multi-line fenced code block ───
  if (!inline && match) {
    return (
      <div className="my-4 rounded-lg overflow-hidden border border-[#3c3c3c] shadow-lg">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#252526] text-gray-400 text-xs select-none">
          <span className="uppercase font-semibold tracking-wider text-[#569cd6]">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 hover:text-white transition-all duration-150"
            title="Copy code"
          >
            {copied ? (
              <>
                {/* Check icon */}
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                {/* Copy icon */}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy code
              </>
            )}
          </button>
        </div>

        {/* Syntax-highlighted body */}
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: '#1e1e1e',
            fontSize: '0.8125rem',
            lineHeight: '1.6',
          }}
          codeTagProps={{ style: { fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace' } }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  // ─── Inline code ───
  return (
    <code
      className="bg-[#2d2d2d] text-[#ce9178] px-1.5 py-0.5 rounded text-[0.8125rem] font-mono border border-[#3c3c3c]"
      {...props}
    >
      {children}
    </code>
  );
};

// ──────────────────────────────────────────────────
// MarkdownMessage – main wrapper used in ChatPage
// ──────────────────────────────────────────────────
export const MarkdownMessage = ({ content }: { content: string }) => {
  return (
    <div className="markdown-body text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // @ts-ignore – react-markdown passes extra node props
          code: CodeBlock,

          // Headings
          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-text-primary">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 text-text-primary">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-text-primary">{children}</h3>,

          // Paragraphs
          p: ({ children }) => <p className="mb-2 last:mb-0 text-inherit">{children}</p>,

          // Lists
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 pl-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 pl-2">{children}</ol>,
          li: ({ children }) => <li className="text-inherit">{children}</li>,

          // Emphasis
          strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,

          // Horizontal rule
          hr: () => <hr className="my-3 border-border" />,

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-500 pl-4 my-2 text-text-secondary italic">
              {children}
            </blockquote>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 underline underline-offset-2 hover:text-primary-300 transition-colors"
            >
              {children}
            </a>
          ),

          // Tables (GFM)
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full text-xs border border-border rounded-md overflow-hidden">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-bg-tertiary">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-text-primary border-b border-border">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-text-secondary">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
