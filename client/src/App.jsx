'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ChatInput from './components/ChatInput'
import ChatMessage from './components/ChatMessage'
import EmptyState from './components/EmptyState'
import { useTheme } from './context/ThemeContext'

export default function App() {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const { theme, toggleTheme } = useTheme()

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
    <div className="flex h-[100dvh] flex-col bg-stone-50 dark:bg-stone-900 text-gray-900 dark:text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <a href="/">
            <h1 className="text-lg font-semibold">Keynes</h1>
          </a>
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 dark:border-stone-600 bg-gray-50 dark:bg-stone-700 text-gray-600 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-600 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="chat-scroll flex-1 overflow-y-auto px-4 pt-6 md:px-6">
        <div className="mx-auto max-w-2xl">
          {!hasMessages ? (
            <EmptyState
              disabled={isLoading}
              onSelect={(suggestion) => submitMessage(suggestion)}
            />
          ) : (
            <div className="space-y-1 pb-40">
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
            <div className="mb-4 rounded-2xl border border-red-200 dark:border-stone-700 bg-red-50 dark:bg-stone-900/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
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
