import { useEffect, useRef } from 'react'
import { surfaceClass } from '../lib/ui'

const scrollbarStyles = `
  textarea.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  textarea.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  textarea.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(160, 160, 160, 0.4);
    border-radius: 3px;
  }

  textarea.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(140, 140, 140, 0.5);
  }

  textarea.custom-scrollbar {
    scrollbar-color: rgba(160, 160, 160, 0.4) transparent;
    scrollbar-width: thin;
  }

  @media (prefers-color-scheme: dark) {
    textarea.custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(160, 160, 160, 0.3);
    }

    textarea.custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(160, 160, 160, 0.4);
    }

    textarea.custom-scrollbar {
      scrollbar-color: rgba(160, 160, 160, 0.3) transparent;
    }
  }
`

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  )
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled = false,
  isLoading = false,
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }, [value])

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!isLoading) onSubmit()
    }
  }

  const handleAction = () => {
    if (isLoading) {
      onStop()
      return
    }
    onSubmit()
  }

  const canSend = !isLoading && value.trim() && !disabled

  return (
    <>
      <style>{scrollbarStyles}</style>
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent dark:from-stone-900 dark:via-stone-900 dark:to-transparent px-4 py-4 md:px-6">
        <div className="mx-auto max-w-3xl">
          <div className={`flex flex-col gap-1 ${surfaceClass} p-4`}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={disabled && !isLoading}
              placeholder="Ask about brand performance, revenue, traffic, or ROAS..."
              className="w-full resize-none overflow-y-auto custom-scrollbar bg-transparent min-h-8 text-[16px] leading-7 text-gray-900 dark:text-stone-100 placeholder:text-gray-500 dark:placeholder:text-stone-500 focus:outline-none disabled:opacity-60 py-1 px-0"
            />

            <div className="flex items-center justify-end gap-2">
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={false}
                  aria-label="Stop response"
                  className="flex h-8 w-8 items-center justify-center rounded border border-red-500 bg-gradient-to-br from-red-700 to-red-600 text-red-400 hover:border-red-400 hover:text-red-300 hover:shadow-[0_0_12px_rgba(220,38,38,0.3)] transition-colors"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={!canSend}
                  aria-label="Send message"
                  className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${canSend
                    ? 'border border-gray-400 dark:border-stone-500 bg-gradient-to-br from-gray-600 to-gray-500 dark:from-stone-600 dark:to-stone-700 text-gray-300 dark:text-stone-300 hover:border-gray-500 dark:hover:border-stone-400 hover:text-gray-200 dark:hover:text-stone-200 hover:shadow-[0_0_12px_rgba(120,113,108,0.2)]'
                    : 'border border-gray-300 dark:border-stone-600 bg-gray-100 dark:bg-stone-800 text-gray-400 dark:text-stone-500 cursor-not-allowed opacity-40'
                    }`}
                >
                  <SendIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
