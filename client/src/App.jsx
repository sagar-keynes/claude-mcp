'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ChatInput from './components/ChatInput'
import ChatMessage from './components/ChatMessage'
import EmptyState from './components/EmptyState'

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
      api:
        import.meta.env.PROD && import.meta.env.VITE_API_BASE_URL
          ? `${import.meta.env.VITE_API_BASE_URL}/api/query/stream`
          : '/api/query/stream',
    }),
    experimental_throttle: 50,
  })

  const isLoading = status === 'submitted' || status === 'streaming'
  const hasMessages = messages.length > 0
  const lastMessage = messages[messages.length - 1]
  const awaitingAssistant =
    isLoading && (!lastMessage || lastMessage.role === 'user')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  const submitMessage = (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    sendMessage({ text: trimmed })
    setInput('')
  }

  const onSubmit = (event) => {
    event?.preventDefault()
    submitMessage(input)
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-100">
      <main className="chat-scroll flex-1 overflow-y-auto px-4 pt-6 md:px-6">
        <div className="mx-auto max-w-3xl">
          {!hasMessages ? (
            <EmptyState
              disabled={isLoading}
              onSelect={(suggestion) => submitMessage(suggestion)}
            />
          ) : (
            <div className="space-y-1 pb-6">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={
                    isLoading &&
                    index === messages.length - 1 &&
                    message.role === 'assistant'
                  }
                />
              ))}

              {awaitingAssistant && (
                <ChatMessage
                  message={{ id: 'pending-assistant', role: 'assistant', parts: [] }}
                  isStreaming
                  status={status}
                />
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error?.message ?? 'Something went wrong. Please try again.'}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        onStop={stop}
        disabled={isLoading}
        isLoading={isLoading}
      />
    </div>
  )
}
