import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { surfaceClass } from '../lib/ui'

const SERIES_COLORS = [
  '#b8956a',
  '#d97706',
  '#8b7355',
  '#a16207',
  '#92400e',
  '#78350f',
]

// Detect dark mode preference
const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

const GRID_COLOR = prefersDark ? '#3a3a38' : '#faf8f7'
const AXIS_COLOR = prefersDark ? '#a8a29e' : '#a8a29e'

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toLocaleString()
}

function buildChartData(input) {
  const labels = input?.xAxis?.data ?? []
  const series = input?.series ?? []

  if (!labels.length && series.length) {
    const maxLen = Math.max(...series.map((s) => s.values?.length ?? 0))
    return Array.from({ length: maxLen }, (_, i) => {
      const point = { label: `#${i + 1}` }
      series.forEach((s) => {
        point[s.name] = s.values?.[i]
      })
      return point
    })
  }

  return labels.map((label, i) => {
    const point = { label }
    series.forEach((s) => {
      point[s.name] = s.values?.[i]
    })
    return point
  })
}

function getSeriesSummary(series) {
  if (!series?.length) return null

  const primary = series[0]
  const values = (primary.values ?? []).filter((value) => typeof value === 'number')
  if (!values.length) return null

  const latest = values[values.length - 1]
  const peak = Math.max(...values)

  return {
    name: primary.name,
    latest,
    peak,
  }
}

function ChartTooltip({ active, payload, label, allData }) {
  if (!active || !payload?.length) return null

  const calculatePercentChange = (currentValue, allValues) => {
    if (!allValues || allValues.length < 2) return null
    const sorted = [...allValues].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const range = max - min
    if (range === 0) return null
    return (((currentValue - min) / range) * 100).toFixed(0)
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 shadow-lg dark:border-stone-700 dark:bg-stone-800/95">
      <p className="mb-2 text-[11px] font-semibold text-stone-600 dark:text-stone-300">{label}</p>
      {payload.map((entry) => {
        const allValues = entry.payload ? Object.values(entry.payload).filter(v => typeof v === 'number') : []
        const percentile = calculatePercentChange(entry.value, allValues)

        return (
          <div key={entry.name} className="mb-1.5 last:mb-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[11px] font-medium text-stone-700 dark:text-stone-200">{entry.name}</span>
            </div>
            <div className="ml-5 flex items-baseline gap-1.5 text-xs">
              <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {formatNumber(entry.value)}
              </span>
              {percentile !== null && (
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  ({percentile}th percentile)
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className={`my-3 overflow-hidden ${surfaceClass}`}>
      <div className="border-b border-gray-200 px-4 py-4 dark:border-stone-700">
        <div className="h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-stone-700" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-200/80 dark:bg-stone-700/80" />
      </div>
      <div className="flex h-[280px] items-end gap-2 px-6 pb-8 pt-6">
        {[38, 62, 44, 78, 52, 68, 48, 72, 58].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-gray-200/80 dark:bg-stone-700/80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function SeriesLegend({ seriesNames }) {
  if (seriesNames.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-2">
      {seriesNames.map((name, index) => (
        <span
          key={name}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 dark:border-stone-700 dark:text-stone-400"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
          />
          {name}
        </span>
      ))}
    </div>
  )
}

function MetricCard({ label, value, context }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-100 px-4 py-3 dark:border-stone-700 dark:bg-stone-800/60">
      <p className="text-xs font-medium text-gray-600 dark:text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-950 dark:text-stone-50">
        {value}
      </p>
      {context && (
        <p className="mt-1 text-xs text-gray-500 dark:text-stone-400">{context}</p>
      )}
    </div>
  )
}

function calculateMetrics(series, xAxisData) {
  if (!series?.length) return null

  const primarySeries = series[0]
  const values = (primarySeries.values ?? []).filter(v => typeof v === 'number')
  if (!values.length) return null

  const total = values.reduce((a, b) => a + b, 0)
  const avg = total / values.length

  let maxVal = values[0]
  let maxIdx = 0
  let minVal = values[0]
  let minIdx = 0

  for (let i = 1; i < values.length; i++) {
    if (values[i] > maxVal) {
      maxVal = values[i]
      maxIdx = i
    }
    if (values[i] < minVal) {
      minVal = values[i]
      minIdx = i
    }
  }

  const maxLabel = xAxisData?.[maxIdx] || `Day ${maxIdx + 1}`
  const minLabel = xAxisData?.[minIdx] || `Day ${minIdx + 1}`

  const first = values[0]
  const last = values[values.length - 1]
  const percentChange = ((last - first) / first) * 100

  return { total, avg, min: minVal, minLabel, max: maxVal, maxLabel, percentChange }
}

function LineChartView({ data, seriesNames, yAxisTitle }) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        interval="preserveStartEnd"
        dy={8}
      />
      <YAxis
        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatNumber}
        width={48}
        label={
          yAxisTitle
            ? {
              value: yAxisTitle,
              angle: -90,
              position: 'insideLeft',
              fill: AXIS_COLOR,
              fontSize: 11,
            }
            : undefined
        }
      />
      <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#c7d2d9', strokeDasharray: '4 4' }} />
      {seriesNames.map((name, i) => (
        <Line
          key={name}
          type="monotone"
          dataKey={name}
          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
        />
      ))}
    </LineChart>
  )
}

function BarChartView({ data, seriesNames, yAxisTitle }) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        interval="preserveStartEnd"
        dy={8}
      />
      <YAxis
        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatNumber}
        width={48}
        label={
          yAxisTitle
            ? {
              value: yAxisTitle,
              angle: -90,
              position: 'insideLeft',
              fill: AXIS_COLOR,
              fontSize: 11,
            }
            : undefined
        }
      />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(180, 140, 110, 0.08)' }} />
      {seriesNames.map((name, i) => (
        <Bar
          key={name}
          dataKey={name}
          fill={SERIES_COLORS[i % SERIES_COLORS.length]}
          radius={[6, 6, 0, 0]}
          maxBarSize={42}
        />
      ))}
    </BarChart>
  )
}

function ScatterChartView({ data, seriesNames, yAxisTitle }) {
  const scatterData = seriesNames.map((name, i) => ({
    name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: data.map((row, idx) => ({
      label: row.label,
      x: idx,
      y: row[name],
    })),
  }))

  return (
    <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" />
      <XAxis
        type="number"
        dataKey="x"
        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => data[v]?.label ?? v}
        dy={8}
      />
      <YAxis
        type="number"
        dataKey="y"
        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatNumber}
        width={48}
        label={
          yAxisTitle
            ? {
              value: yAxisTitle,
              angle: -90,
              position: 'insideLeft',
              fill: AXIS_COLOR,
              fontSize: 11,
            }
            : undefined
        }
      />
      <Tooltip
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const point = payload[0]?.payload
          return (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 shadow-lg dark:border-slate-800 dark:bg-slate-900/95">
              <p className="text-[11px] text-slate-500">{point?.label}</p>
              <p className="text-xs font-medium tabular-nums text-slate-100">
                {formatNumber(point?.y)}
              </p>
            </div>
          )
        }}
      />
      {scatterData.map(({ name, color, points }) => (
        <Scatter key={name} name={name} data={points} fill={color} />
      ))}
    </ScatterChart>
  )
}

export default function ChartDisplay({ input, state }) {
  const isLoading =
    state === 'input-streaming' ||
    state === 'input-available' ||
    !input?.series?.length

  if (isLoading) {
    return <ChartSkeleton />
  }

  const style = input.style ?? 'line'
  const data = buildChartData(input)
  const seriesNames = input.series.map((s) => s.name)
  const yAxisTitle = input.yAxis?.title
  const xAxisData = input.xAxis?.data
  const summary = getSeriesSummary(input.series)
  // Use Claude's metrics if provided, otherwise auto-calculate
  const metrics = input.metrics || calculateMetrics(input.series, xAxisData)

  return (
    <div className={`my-3 overflow-hidden ${surfaceClass}`}>
      <div className="border-b border-stone-200 px-4 py-4 dark:border-stone-700">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-medium leading-6 text-gray-950 dark:text-stone-100">
              {input.title}
            </h3>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <span className="rounded-full border border-stone-200 px-2.5 py-1 text-[10px] uppercase tracking-wide text-gray-600 dark:border-stone-700 dark:text-stone-500">
              {style} chart
            </span>
            <SeriesLegend seriesNames={seriesNames} />
          </div>
        </div>

        {metrics && Array.isArray(metrics) && metrics.length > 0 && (
          <div className={`grid gap-3 ${metrics.length === 1 ? 'grid-cols-1' : metrics.length === 2 ? 'grid-cols-2' : metrics.length === 3 ? 'grid-cols-3 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {metrics.map((metric, idx) => (
              <MetricCard
                key={idx}
                label={metric.label}
                value={metric.value}
                context={metric.context}
              />
            ))}
          </div>
        )}
        {metrics && !Array.isArray(metrics) && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Total"
              value={formatNumber(metrics.total)}
            />
            <MetricCard
              label="Daily average"
              value={formatNumber(metrics.avg)}
            />
            <MetricCard
              label={`Peak (${metrics.maxLabel})`}
              value={formatNumber(metrics.max)}
            />
            <MetricCard
              label={`Low (${metrics.minLabel})`}
              value={formatNumber(metrics.min)}
            />
          </div>
        )}
      </div>

      <div className="bg-gray-50 px-1 py-4 dark:bg-stone-900/30">
        <ResponsiveContainer width="100%" height={280}>
          {style === 'bar' ? (
            <BarChartView
              data={data}
              seriesNames={seriesNames}
              yAxisTitle={yAxisTitle}
            />
          ) : style === 'scatter' ? (
            <ScatterChartView
              data={data}
              seriesNames={seriesNames}
              yAxisTitle={yAxisTitle}
            />
          ) : (
            <LineChartView
              data={data}
              seriesNames={seriesNames}
              yAxisTitle={yAxisTitle}
            />
          )}
        </ResponsiveContainer>
      </div>

      {input.xAxis?.title && (
        <div className="border-t border-gray-200 px-4 py-2.5 text-center text-[11px] text-gray-600 dark:border-stone-700 dark:text-stone-500">
          {input.xAxis.title}
        </div>
      )}
    </div>
  )
}
