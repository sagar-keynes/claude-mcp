import MessageParts, { hasVisibleAssistantContent } from './MessageParts'

function ThinkingIndicator({ status = 'streaming' }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-gray-600 dark:text-stone-400">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-stone-500 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-stone-500 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-stone-500" />
      </span>
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
        <div className="max-w-[85%] rounded-2xl border border-gray-200 dark:border-stone-700 bg-gray-100 dark:bg-stone-700 px-4 py-3 md:max-w-[72%]">
          <MessageParts message={message} isUser />
        </div>
      </div>
    )
  }

  return (
    <div className="py-4">
      <div className="flex gap-3 md:gap-4">
        <div className="min-w-0 flex-1 text-[15px] leading-7 text-gray-950 dark:text-stone-100">
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
