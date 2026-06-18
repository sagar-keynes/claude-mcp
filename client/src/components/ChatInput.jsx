import { useEffect, useRef } from 'react'
import { surfaceClass } from '../lib/ui'

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M3.4 20.6 21 12 3.4 3.4l-.9 7.3 9.2 1.3-9.2 1.3.9 7.3z" />
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
    <div className="bg-slate-950/95 px-4 pb-4 pt-2 backdrop-blur md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className={`relative ${surfaceClass}`}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled && !isLoading}
            placeholder="Ask about brand performance, revenue, traffic, or ROAS..."
            className="max-h-[180px] min-h-[52px] w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-[15px] leading-7 text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
          />

          <button
            type="button"
            onClick={handleAction}
            disabled={!isLoading && !canSend}
            aria-label={isLoading ? 'Stop response' : 'Send message'}
            className={`absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full transition ${
              isLoading
                ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                : 'bg-slate-100 text-slate-900 enabled:hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500'
            }`}
          >
            {isLoading ? <StopIcon /> : <SendIcon />}
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">
          Athena uses your connected marketing data. Responses may include charts and analysis.
        </p>
      </div>
    </div>
  )
}
