import MessageParts, { hasVisibleAssistantContent } from './MessageParts'

function ThinkingIndicator({ status = 'streaming' }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-slate-400">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
      </span>
    </div>
  )
}

function AthenaAvatar() {
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-900/40 text-xs font-medium text-slate-300">
      A
    </div>
  )
}

export default function ChatMessage({
  message,
  isStreaming = false,
  status = 'streaming',
}) {
  const isUser = message.role === 'user'
  const showThinking =
    !isUser && isStreaming && !hasVisibleAssistantContent(message)

  if (isUser) {
    return (
      <div className="flex justify-end py-3">
        <div className="max-w-[85%] rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40 md:max-w-[72%]">
          <MessageParts message={message} isUser />
        </div>
      </div>
    )
  }

  return (
    <div className="py-4">
      <div className="flex gap-3 md:gap-4">
        <AthenaAvatar />
        <div className="min-w-0 flex-1 text-[15px] leading-7 text-slate-100">
          {showThinking ? (
            <ThinkingIndicator status={status} />
          ) : (
            <MessageParts message={message} isStreaming={isStreaming} />
          )}
        </div>
      </div>
    </div>
  )
}
