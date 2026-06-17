'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ChartDisplay from './components/ChartDisplay'
import DataToolBadge from './components/DataToolBadge'

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
  }, [messages])

  const onSubmit = (e) => {
    e?.preventDefault()

    if (!input.trim() || isLoading) {
      return
    }

    sendMessage({
      text: input,
    })

    setInput('')
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
    <div className="min-h-screen bg-[#0d0f14] px-4 py-10 text-slate-200">
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-6">

        {/* Header */}

        <div>
          <div className="mb-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.25em] text-violet-500">
            Athena Chat
          </div>
        </div>

        {/* Conversation */}

        <div className="overflow-hidden rounded-2xl border border-[#1e2130] bg-[#13151c]">
          <div className="flex items-center justify-between border-b border-[#1e2130] px-5 py-3.5">
            <span className="text-xs uppercase tracking-[0.1em] text-gray-600">
              Conversation
            </span>

            <span
              className={`flex items-center gap-1.5 text-[11px]
              ${isLoading
                  ? 'text-violet-600'
                  : status === 'error'
                    ? 'text-red-500'
                    : 'text-gray-700'
                }`}
            >
              {isLoading && <Spinner />}
              {statusLabel}
            </span>
          </div>

          <div className="chat-scroll flex max-h-[52vh] flex-col gap-4 overflow-y-auto p-5">
            {messages.map((message) => {
              const isUser =
                message.role === 'user'

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser
                    ? 'justify-end'
                    : 'justify-start'
                    }`}
                >
                  <div
                    className={`
                      px-4 py-3
                      ${isUser
                        ? 'max-w-[82%] rounded-[18px_18px_4px_18px] bg-gradient-to-br from-violet-700 to-violet-600 shadow-[0_4px_20px_rgba(124,58,237,0.25)]'
                        : 'w-full max-w-full rounded-[18px_18px_18px_4px] border border-[#252839] bg-[#1a1d27] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                      }
                    `}
                  >
                    <div
                      className={`mb-1.5 text-[10px] uppercase tracking-[0.2em] opacity-60 ${isUser
                        ? 'text-violet-200'
                        : 'text-gray-500'
                        }`}
                    >
                      {isUser
                        ? 'You'
                        : 'Athena'}
                    </div>

                    <div
                      className={`break-words text-[13px] leading-7 ${isUser
                        ? 'text-violet-100'
                        : 'text-gray-300'
                        }`}
                    >
                      <MessageParts
                        message={message}
                      />

                      {!isUser &&
                        !message.parts
                          ?.length &&
                        isLoading && (
                          <span className="opacity-50">
                            <Spinner />
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              )
            })}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}

        <div className="flex flex-col gap-3.5 rounded-2xl border border-[#1e2130] bg-[#13151c] p-5">
          <label className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
            Send a new question
          </label>

          <textarea
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            onKeyDown={onKeyDown}
            rows={3}
            disabled={isLoading}
            placeholder="Ask Athena about your data, query results, or schema…"
            className="
              min-h-[90px]
              resize-y
              rounded-xl
              border border-[#252839]
              bg-[#0d0f14]
              px-4 py-3
              text-[13px]
              leading-6
              text-slate-200
              outline-none
              transition-colors
              focus:border-violet-600
            "
          />

          <div className="flex justify-end gap-2">
            {isLoading && (
              <button
                onClick={stop}
                className="
                  rounded-full border border-gray-700
                  px-5 py-2 text-sm text-gray-400
                  transition-all
                  hover:border-red-500
                  hover:text-red-300
                "
              >
                Stop
              </button>
            )}

            <button
              onClick={onSubmit}
              disabled={
                !input.trim() ||
                isLoading
              }
              className="
                rounded-full px-6 py-2 text-sm font-medium
                transition-all
                disabled:cursor-not-allowed
                disabled:bg-[#1e2130]
                disabled:text-gray-700
                enabled:bg-gradient-to-br
                enabled:from-violet-700
                enabled:to-violet-600
                enabled:text-violet-100
                enabled:shadow-[0_4px_14px_rgba(124,58,237,0.35)]
              "
            >
              Send message
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
