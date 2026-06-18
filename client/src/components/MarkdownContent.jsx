import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownContent({ children, className = '' }) {
  if (!children?.trim()) return null

  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: content }) => (
            <p className="mb-3 last:mb-0">{content}</p>
          ),
          ul: ({ children: content }) => (
            <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">{content}</ul>
          ),
          ol: ({ children: content }) => (
            <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">{content}</ol>
          ),
          li: ({ children: content }) => <li className="leading-7">{content}</li>,
          strong: ({ children: content }) => (
            <strong className="font-semibold text-slate-100">{content}</strong>
          ),
          em: ({ children: content }) => <em className="italic text-slate-300">{content}</em>,
          h1: ({ children: content }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold text-slate-100 first:mt-0">
              {content}
            </h3>
          ),
          h2: ({ children: content }) => (
            <h4 className="mb-2 mt-4 text-[15px] font-semibold text-slate-100 first:mt-0">
              {content}
            </h4>
          ),
          h3: ({ children: content }) => (
            <h5 className="mb-2 mt-3 text-sm font-semibold text-slate-100 first:mt-0">
              {content}
            </h5>
          ),
          blockquote: ({ children: content }) => (
            <blockquote className="my-3 border-l-2 border-slate-700 pl-4 text-slate-400">
              {content}
            </blockquote>
          ),
          code: ({ inline, children: content }) =>
            inline ? (
              <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-200">
                {content}
              </code>
            ) : (
              <code className="font-mono text-[13px] text-slate-200">{content}</code>
            ),
          pre: ({ children: content }) => (
            <pre className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-[13px] leading-6">
              {content}
            </pre>
          ),
          a: ({ href, children: content }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#c96442] underline decoration-[#c96442]/30 underline-offset-2 hover:text-[#da7756]"
            >
              {content}
            </a>
          ),
          table: ({ children: content }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
              <table className="min-w-full text-left text-sm">{content}</table>
            </div>
          ),
          thead: ({ children: content }) => (
            <thead className="border-b border-slate-800 text-slate-400">{content}</thead>
          ),
          th: ({ children: content }) => (
            <th className="px-3 py-2 font-medium">{content}</th>
          ),
          td: ({ children: content }) => (
            <td className="border-t border-slate-800 px-3 py-2 align-top">{content}</td>
          ),
          hr: () => <hr className="my-4 border-slate-800" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
