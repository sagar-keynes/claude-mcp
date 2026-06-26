const TOOL_META = {
  get_available_datasets: {
    running: 'Checking available datasets',
    done: 'Available datasets loaded',
    icon: 'datasets',
  },
  list_ga4_advertisers: {
    running: 'Loading connected brands',
    done: 'Connected brands loaded',
    icon: 'brands',
  },
  get_ga4_date_metrics: {
    running: 'Fetching performance metrics',
    done: 'Performance metrics retrieved',
    icon: 'metrics',
  },
  query_athena: {
    running: 'Running data query',
    done: 'Data query completed',
    icon: 'query',
  },
  get_table_schema: {
    running: 'Loading table schema',
    done: 'Table schema loaded',
    icon: 'schema',
  },
  get_current_date: {
    running: 'Checking date ranges',
    done: 'Date ranges resolved',
    icon: 'calendar',
  },
}

function ToolIcon({ type }) {
  const className = 'h-4 w-4 text-gray-600 dark:text-stone-400'

  switch (type) {
    case 'metrics':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 19V5M10 19V9M16 19V12M22 19V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'brands':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'query':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
          <ellipse cx="12" cy="7" rx="7" ry="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'calendar':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
  }
}

function StatusIndicator({ isRunning, isError, isComplete }) {
  if (isRunning) {
    return (
      <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-400 dark:border-stone-700 border-t-gray-600 dark:border-t-stone-300" />
    )
  }

  if (isError) {
    return (
      <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  if (isComplete) {
    return (
      <svg className="h-4 w-4 shrink-0 text-emerald-400/80" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3.5 8.2 6.4 11 12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return null
}

function formatToolName(toolName) {
  return toolName.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function DataToolBadge({ part }) {
  const toolName =
    part.toolName ||
    part.type?.replace(/^tool-/, '') ||
    'Tool'

  const meta = TOOL_META[toolName]
  const isRunning =
    part.state === 'input-streaming' ||
    part.state === 'input-available' ||
    part.state === 'output-streaming'

  const isComplete = part.state === 'output-available'
  const isError = part.state === 'output-error' || !!part.error

  const title = isError
    ? 'Unable to fetch data'
    : isRunning
      ? meta?.running ?? `Running ${formatToolName(toolName)}`
      : meta?.done ?? formatToolName(toolName)

  const subtitle = isError
    ? String(part.error ?? part.errorText ?? 'Please try again.')
    : isRunning
      ? 'This usually takes a few seconds'
      : 'Data source ready'

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors ${
        isError
          ? 'border-red-500/20 bg-red-500/[0.06]'
          : isRunning
            ? 'border-gray-200 bg-gray-50 dark:border-stone-800 dark:bg-stone-900/40'
            : 'border-gray-200 bg-gray-50/80 dark:border-stone-800 dark:bg-stone-900/30'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          isError
            ? 'border-red-500/20 bg-red-500/10'
            : 'border-gray-200 bg-gray-100 dark:border-stone-800 dark:bg-stone-900/60'
        }`}
      >
        <ToolIcon type={meta?.icon ?? 'datasets'} />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            isError ? 'text-red-700 dark:text-red-200' : 'text-gray-900 dark:text-stone-100'
          }`}
        >
          {title}
        </p>
        <p
          className={`truncate text-xs ${
            isError ? 'text-red-600 dark:text-red-300/70' : 'text-gray-600 dark:text-stone-500'
          }`}
        >
          {subtitle}
        </p>
      </div>

      <StatusIndicator
        isRunning={isRunning}
        isError={isError}
        isComplete={isComplete}
      />
    </div>
  )
}
