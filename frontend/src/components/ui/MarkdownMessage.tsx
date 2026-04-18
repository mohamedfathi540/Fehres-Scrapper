import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ──────────────────────────────────────────────────
// CodeBlock – fenced & inline code
// ──────────────────────────────────────────────────
const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Multi-line fenced block ───
  if (!inline && match) {
    return (
      <div className="my-6 rounded-md overflow-hidden border border-border bg-[#1e1e1e] shadow-sm">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary text-text-muted text-xs border-b border-border">
          <span className="uppercase font-semibold tracking-wider">{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors focus:outline-none"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.6',
          }}
          codeTagProps={{
            style: { fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace' },
          }}
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
      className="bg-bg-tertiary text-primary-400 px-1.5 py-0.5 rounded-md font-mono text-sm border border-border"
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
    <div className="text-text-primary break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Code ──────────────────────────────────
          // @ts-ignore
          code: CodeBlock,

          // ── Headings ──────────────────────────────
          h1: ({ node: _n, ...props }) => (
            <h1
              className="text-2xl font-bold text-text-primary mt-6 mb-4 pb-2 border-b border-border"
              {...props}
            />
          ),
          h2: ({ node: _n, ...props }) => (
            <h2 className="text-xl font-semibold text-text-primary mt-5 mb-3" {...props} />
          ),
          h3: ({ node: _n, ...props }) => (
            <h3 className="text-lg font-medium text-text-primary mt-4 mb-2" {...props} />
          ),
          h4: ({ node: _n, ...props }) => (
            <h4 className="text-base font-medium text-text-secondary mt-4 mb-2" {...props} />
          ),

          // ── Text & Paragraphs ─────────────────────
          p: ({ node: _n, ...props }) => (
            <p className="leading-relaxed mb-4 last:mb-0 text-text-secondary" {...props} />
          ),
          strong: ({ node: _n, ...props }) => (
            <strong className="font-semibold text-text-primary" {...props} />
          ),
          em: ({ node: _n, ...props }) => (
            <em className="italic text-text-secondary" {...props} />
          ),

          // ── Lists ─────────────────────────────────
          ul: ({ node: _n, ...props }) => (
            <ul
              className="list-disc list-outside ml-5 mb-4 text-text-secondary space-y-1 marker:text-primary-500"
              {...props}
            />
          ),
          ol: ({ node: _n, ...props }) => (
            <ol
              className="list-decimal list-outside ml-5 mb-4 text-text-secondary space-y-1 marker:text-primary-500"
              {...props}
            />
          ),
          li: ({ node: _n, ...props }) => (
            <li className="leading-relaxed pl-1" {...props} />
          ),

          // ── Links ─────────────────────────────────
          a: ({ node: _n, ...props }) => (
            <a
              className="text-primary-500 hover:text-primary-400 underline decoration-primary-500/30 hover:decoration-primary-400 transition-colors cursor-pointer"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),

          // ── Blockquotes ───────────────────────────
          blockquote: ({ node: _n, ...props }) => (
            <blockquote
              className="border-l-4 border-primary-500 pl-4 py-1 my-4 bg-bg-secondary/50 rounded-r-lg italic text-text-muted"
              {...props}
            />
          ),

          // ── Horizontal Rule ───────────────────────
          hr: () => <hr className="my-4 border-border" />,

          // ── Tables (GFM) ──────────────────────────
          table: ({ node: _n, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table
                className="min-w-full divide-y divide-border border border-border rounded-lg"
                {...props}
              />
            </div>
          ),
          thead: ({ node: _n, ...props }) => <thead {...props} />,
          tbody: ({ node: _n, ...props }) => (
            <tbody className="divide-y divide-border" {...props} />
          ),
          tr: ({ node: _n, ...props }) => <tr {...props} />,
          th: ({ node: _n, ...props }) => (
            <th
              className="px-4 py-2 bg-bg-secondary text-left text-sm font-semibold text-text-primary"
              {...props}
            />
          ),
          td: ({ node: _n, ...props }) => (
            <td className="px-4 py-2 border-t border-border text-sm text-text-secondary" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
