const TOOL_LABELS = {
  get_current_date: 'Date ranges',
  query_athena: 'Athena query',
  get_table_schema: 'Table schema',
  get_available_datasets: 'Datasets',
  list_ga4_advertisers: 'Advertisers',
  get_ga4_date_metrics: 'GA4 metrics',
}

const STATUS = {
  'input-streaming': { label: 'Preparing', tone: 'pending' },
  'input-available': { label: 'Running', tone: 'active' },
  'output-streaming': { label: 'Receiving', tone: 'active' },
  'output-available': { label: 'Done', tone: 'done' },
  'output-error': { label: 'Failed', tone: 'error' },
  'approval-requested': { label: 'Awaiting approval', tone: 'pending' },
  'approval-responded': { label: 'Approved', tone: 'done' },
  'output-denied': { label: 'Denied', tone: 'error' },
}

function StatusDot({ tone }) {
  const colors = {
    pending: 'bg-gray-500',
    active: 'bg-violet-400 animate-pulse',
    done: 'bg-emerald-400',
    error: 'bg-red-400',
  }

  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[tone] ?? colors.pending}`} />
}

function summarizeOutput(output) {
  if (!output || typeof output !== 'object') return null

  if (typeof output.row_count === 'number') {
    return `${output.row_count.toLocaleString()} rows`
  }

  if (Array.isArray(output)) {
    return `${output.length} items`
  }

  if (Array.isArray(output.advertisers)) {
    return `${output.advertisers.length} advertisers`
  }

  if (Array.isArray(output.datasets)) {
    return `${output.datasets.length} datasets`
  }

  if (output.success === false) {
    return 'Error'
  }

  return null
}

export default function DataFetchTool({ part }) {
  const rawName =
    part.toolName ||
    part.type?.replace(/^tool-/, '') ||
    'Tool'

  const label = TOOL_LABELS[rawName] ?? rawName.replace(/_/g, ' ')
  const status = STATUS[part.state] ?? { label: part.state, tone: 'pending' }
  const summary = summarizeOutput(part.output)

  return (
    <div className="data-fetch-tool">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone={status.tone} />
        <span className="truncate text-xs text-gray-400">{label}</span>
        <span className="text-[10px] text-gray-600">·</span>
        <span className="shrink-0 text-[10px] text-gray-600">{status.label}</span>
        {summary && status.tone === 'done' && (
          <>
            <span className="text-[10px] text-gray-600">·</span>
            <span className="shrink-0 text-[10px] text-emerald-500/80">{summary}</span>
          </>
        )}
      </div>

      {(part.input || part.output || part.error) && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[10px] text-gray-600 hover:text-gray-500">
            Details
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {part.input && (
              <pre className="max-h-32 overflow-auto rounded bg-[#0d0f14] p-2 text-[10px] text-slate-400">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            )}
            {part.output && (
              <pre className="max-h-32 overflow-auto rounded bg-[#0d0f14] p-2 text-[10px] text-slate-400">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            )}
            {part.error && (
              <p className="text-[10px] text-red-400">{String(part.error)}</p>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
