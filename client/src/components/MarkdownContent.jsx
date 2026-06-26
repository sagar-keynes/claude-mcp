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
            <strong className="font-semibold text-gray-950 dark:text-stone-100">{content}</strong>
          ),
          em: ({ children: content }) => <em className="italic text-gray-800 dark:text-stone-300">{content}</em>,
          h1: ({ children: content }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold text-gray-950 dark:text-stone-100 first:mt-0">
              {content}
            </h3>
          ),
          h2: ({ children: content }) => (
            <h4 className="mb-2 mt-4 text-[15px] font-semibold text-gray-950 dark:text-stone-100 first:mt-0">
              {content}
            </h4>
          ),
          h3: ({ children: content }) => (
            <h5 className="mb-2 mt-3 text-sm font-semibold text-gray-950 dark:text-stone-100 first:mt-0">
              {content}
            </h5>
          ),
          blockquote: ({ children: content }) => (
            <blockquote className="my-3 border-l-2 border-gray-300 dark:border-stone-700 pl-4 text-gray-700 dark:text-stone-400">
              {content}
            </blockquote>
          ),
          code: ({ inline, children: content }) =>
            inline ? (
              <code className="rounded bg-gray-200 dark:bg-stone-700 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-900 dark:text-stone-100">
                {content}
              </code>
            ) : (
              <code className="font-mono text-[13px] text-gray-900 dark:text-stone-100">{content}</code>
            ),
          pre: ({ children: content }) => (
            <pre className="my-3 overflow-auto rounded-xl border border-gray-300 dark:border-stone-700 bg-gray-100 dark:bg-stone-800 p-4 text-[13px] leading-6">
              {content}
            </pre>
          ),
          a: ({ href, children: content }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-purple-600 dark:text-purple-400 underline decoration-purple-400 dark:decoration-purple-500 underline-offset-2 hover:text-purple-700 dark:hover:text-purple-300"
            >
              {content}
            </a>
          ),
          table: ({ children: content }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-gray-300 dark:border-stone-700 bg-gray-50 dark:bg-stone-800">
              <table className="min-w-full text-left text-sm">{content}</table>
            </div>
          ),
          thead: ({ children: content }) => (
            <thead className="border-b border-gray-300 dark:border-stone-700 text-gray-700 dark:text-stone-400">{content}</thead>
          ),
          th: ({ children: content }) => (
            <th className="px-3 py-2 font-medium">{content}</th>
          ),
          td: ({ children: content }) => (
            <td className="border-t border-gray-200 dark:border-stone-700 px-3 py-2 align-top">{content}</td>
          ),
          hr: () => <hr className="my-4 border-gray-300 dark:border-stone-700" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
