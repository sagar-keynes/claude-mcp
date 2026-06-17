const TOOL_LABELS = {
  get_available_datasets: 'Loading datasets',
  list_ga4_advertisers: 'Fetching advertisers',
  get_ga4_date_metrics: 'Fetching GA4 metrics',
  query_athena: 'Running Athena query',
  get_table_schema: 'Loading table schema',
  get_current_date: 'Getting date ranges',
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-violet-500/30 border-t-violet-400" />
  )
}

function CheckIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0 text-emerald-400"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.5 6L5 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0 text-red-400"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 3L9 9M9 3L3 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function DataToolBadge({ part }) {
  const toolName =
    part.toolName ||
    part.type?.replace(/^tool-/, '') ||
    'Tool'

  const label = TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ')

  const isRunning =
    part.state === 'input-streaming' ||
    part.state === 'input-available' ||
    part.state === 'output-streaming'

  const isComplete = part.state === 'output-available'
  const isError = part.state === 'output-error' || !!part.error

  return (
    <div
      className={`my-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
        isError
          ? 'text-red-400/90'
          : isComplete
            ? 'text-gray-600'
            : 'text-gray-500'
      }`}
    >
      {isRunning && <Spinner />}
      {isComplete && !isError && <CheckIcon />}
      {isError && <ErrorIcon />}
      <span className="truncate">{label}</span>
      {isComplete && !isError && (
        <span className="text-[10px] text-gray-700">done</span>
      )}
      {isError && (
        <span className="truncate text-[10px] text-red-400/80">
          {String(part.error ?? 'failed')}
        </span>
      )}
    </div>
  )
}
