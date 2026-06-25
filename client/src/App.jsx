'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ChartDisplay from './components/ChartDisplay'
import DataToolBadge from './components/DataToolBadge'

const scrollbarStyles = `
  textarea.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  textarea.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  textarea.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(124, 58, 237, 0.4);
    border-radius: 3px;
  }

  textarea.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(124, 58, 237, 0.6);
  }

  textarea.custom-scrollbar {
    scrollbar-color: rgba(124, 58, 237, 0.4) transparent;
    scrollbar-width: thin;
  }
`

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  )
}

function ToolCard({ part }) {
  const toolName =
    part.toolName ||
    part.type?.replace(/^tool-/, '') ||
    'Tool'

  if (toolName === 'chartDisplayTool') {
    return (
      <ChartDisplay
        input={part.input}
        state={part.state}
      />
    )
  }

  return <DataToolBadge part={part} />
}

function MessageParts({ message }) {
  if (!message.parts?.length) return null

  return (
    <>
      {message.parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <div
              key={index}
              className="whitespace-pre-wrap"
            >
              {part.text}
            </div>
          )
        }

        if (part.type === 'reasoning') {
          return (
            <details
              key={index}
              className="my-2"
            >
              <summary className="cursor-pointer text-xs text-gray-500">
                Reasoning
              </summary>

              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-400">
                {part.text}
              </pre>
            </details>
          )
        }

        const isTool =
          part.type === 'dynamic-tool' ||
          part.type?.startsWith('tool-')

        if (isTool) {
          return (
            <ToolCard
              key={index}
              part={part}
            />
          )
        }

        return (
          <details
            key={index}
            className="my-2"
          >
            <summary className="cursor-pointer text-xs text-gray-500">
              {part.type || 'Unknown Part'}
            </summary>

            <pre className="mt-2 overflow-auto rounded bg-[#11141c] p-2 text-[11px] text-slate-300">
              {JSON.stringify(part, null, 2)}
            </pre>
          </details>
        )
      })}
    </>
  )
}

export default function App() {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const textareaRef = useRef(null)

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
  } = useChat({
    transport: new DefaultChatTransport({
      api: import.meta.env.VITE_API_BASE_URL
        ? `${import.meta.env.VITE_API_BASE_URL}/api/query/stream`
        : '/api/query/stream',
    }),
    experimental_throttle: 50,
  })

  const isLoading =
    status === 'submitted' ||
    status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
    setShowScrollButton(false)
  }, [messages])

  const handleScroll = () => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const onSubmit = (e) => {
    e?.preventDefault()

    if (!input.trim() || isLoading) {
      return
    }

    sendMessage({
      text: input,
    })

    setInput('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const onKeyDown = (e) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault()
      onSubmit()
    }
  }

  const statusLabel = (() => {
    if (status === 'submitted')
      return 'Connecting…'

    if (status === 'streaming')
      return 'Athena is typing…'

    if (status === 'error') {
      return `Error: ${error?.message ?? 'unknown'
        }`
    }

    return 'Ready'
  })()

  return (
    <div className="flex h-screen flex-col bg-[#0d0f14] text-slate-200">
      <style>{scrollbarStyles}</style>
      {/* Header */}
      <div className="border-b border-[#1e2130] px-6 py-4">
        <h1 className="text-lg font-semibold">Athena</h1>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6 pb-40">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="text-4xl font-semibold text-slate-300">Athena</div>
              <p className="max-w-md text-sm text-slate-400">
                Ask questions about your Kortex analytics data
              </p>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === 'user'

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-2xl gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                >
                  {!isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e2130]">
                      <span className="text-xs font-semibold">A</span>
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 ${isUser
                      ? 'bg-[#1a1d27]'
                      : 'bg-[#13151c]'
                      }`}
                  >
                    <div
                      className={`text-sm leading-7 ${isUser ? 'text-slate-200' : 'text-slate-300'
                        }`}
                    >
                      <MessageParts message={message} />

                      {!isUser &&
                        !message.parts?.length &&
                        isLoading && (
                          <span className="opacity-50">
                            <Spinner />
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            onClick={scrollToBottom}
            className="flex items-center justify-center h-9 w-9 rounded-full border border-[#252839] bg-[#13151c] text-slate-400 hover:border-slate-600 transition-colors"
            title="Scroll to latest"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      {/* Floating Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0d0f14] via-[#0d0f14] to-transparent px-6 py-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-[#252839] bg-[#13151c] p-4 shadow-xl">
            <div className="flex flex-col gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={onKeyDown}
                rows={1}
                disabled={isLoading}
                placeholder="Ask Athena about your data, query results, or schema…"
                className="
                  w-full resize-none overflow-y-auto custom-scrollbar
                  bg-transparent
                  text-sm text-slate-200
                  placeholder-slate-500
                  outline-none
                  disabled:opacity-50
                  pt-1.5 pb-1 px-0
                "
              />

              <div className="flex items-center justify-end">
                {isLoading ? (
                  <button
                    onClick={stop}
                    className="
                      flex h-8 w-8 items-center justify-center
                      rounded
                      transition-colors
                      border border-red-500
                      bg-gradient-to-br from-red-700 to-red-600
                      text-red-400
                      hover:border-red-400
                      hover:text-red-300
                      hover:shadow-[0_0_12px_rgba(220,38,38,0.3)]
                    "
                    title="Stop generating"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={onSubmit}
                    disabled={!input.trim()}
                    className="
                      flex h-8 w-8 items-center justify-center
                      rounded text-slate-400
                      transition-colors
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                      disabled:border disabled:border-[#252839]
                      enabled:border enabled:border-violet-500
                      enabled:bg-gradient-to-br
                    enabled:from-violet-700
                    enabled:to-violet-600
                    enabled:text-violet-400
                    enabled:hover:border-violet-400
                    enabled:hover:text-violet-300
                      enabled:hover:shadow-[0_0_12px_rgba(124,58,237,0.3)]
                    "
                    title="Send message (Enter)"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
