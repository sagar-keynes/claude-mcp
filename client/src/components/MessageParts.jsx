import ChartDisplay from './ChartDisplay'
import DataToolBadge from './DataToolBadge'
import MarkdownContent from './MarkdownContent'
import { surfaceClass } from '../lib/ui'

const HIDDEN_PART_TYPES = new Set(['step-start'])

function isToolPart(part) {
  return part.type === 'dynamic-tool' || part.type?.startsWith('tool-')
}

function getToolName(part) {
  return part.toolName || part.type?.replace(/^tool-/, '') || 'Tool'
}

function getPartKey(part, index) {
  if (part.toolCallId) return part.toolCallId
  if (part.id) return part.id
  if (part.type === 'text' || part.type === 'reasoning') {
    return `${part.type}-${index}`
  }
  return `${part.type}-${index}`
}

function ToolPart({ part }) {
  const toolName = getToolName(part)

  if (toolName === 'chartDisplayTool') {
    return <ChartDisplay input={part.input} state={part.state} />
  }

  return <DataToolBadge part={part} />
}

function ReasoningPart({ part }) {
  if (!part.text?.trim()) return null

  return (
    <details className={`group ${surfaceClass}`}>
      <summary className="cursor-pointer list-none px-3 py-2 text-xs text-slate-400 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="transition group-open:rotate-90">›</span>
          View thinking
        </span>
      </summary>
      <div className="border-t border-slate-100 px-3 py-3 text-xs leading-6 text-slate-400 dark:border-slate-800">
        <MarkdownContent>{part.text}</MarkdownContent>
      </div>
    </details>
  )
}

function SourcePart({ part }) {
  if (part.type === 'source-url') {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex max-w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-slate-100 ${surfaceClass}`}
      >
        <span className="truncate">{part.title || part.url}</span>
      </a>
    )
  }

  return null
}

function getVisibleParts(parts = []) {
  return parts.filter((part) => {
    if (!part?.type || HIDDEN_PART_TYPES.has(part.type)) return false
    if (part.type.startsWith('data-')) return false
    return true
  })
}

export function hasVisibleAssistantContent(message) {
  return getVisibleParts(message.parts).some((part) => {
    if (part.type === 'text') return !!part.text?.trim()
    if (part.type === 'reasoning') return !!part.text?.trim()
    if (isToolPart(part)) return true
    if (part.type === 'source-url' || part.type === 'source-document') return true
    return false
  })
}

function renderPart(part, isUser) {
  if (part.type === 'text') {
    if (isUser) {
      return (
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800 dark:text-slate-100">
          {part.text}
        </p>
      )
    }

    return <MarkdownContent>{part.text}</MarkdownContent>
  }

  if (part.type === 'reasoning') {
    return <ReasoningPart part={part} />
  }

  if (isToolPart(part)) {
    return <ToolPart part={part} />
  }

  if (part.type === 'source-url' || part.type === 'source-document') {
    return <SourcePart part={part} />
  }

  if (part.type === 'file') {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex px-3 py-2 text-sm text-slate-300 ${surfaceClass}`}
      >
        {part.filename || 'Attached file'}
      </a>
    )
  }

  return null
}

export default function MessageParts({ message, isUser = false, isStreaming = false }) {
  const parts = getVisibleParts(message.parts)

  if (!parts.length) return null

  return (
    <div className="space-y-3">
      {parts.map((part, index) => {
        const content = renderPart(part, isUser)
        if (!content) return null

        return <div key={getPartKey(part, index)}>{content}</div>
      })}

      {!isUser && isStreaming && parts.some((part) => part.type === 'text' && part.state === 'streaming') && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-slate-400" aria-hidden />
      )}
    </div>
  )
}
