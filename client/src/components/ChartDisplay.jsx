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
  '#c96442',
  '#6b8caf',
  '#788c5d',
  '#b8956a',
  '#9580a5',
  '#7ea3a8',
]

const GRID_COLOR = '#1e293b'
const AXIS_COLOR = '#64748b'

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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 shadow-lg dark:border-slate-800 dark:bg-slate-900/95">
      <p className="mb-1.5 text-[11px] font-medium text-slate-500">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs text-slate-200">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-400">{entry.name}</span>
          <span className="font-medium tabular-nums text-slate-100">
            {formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className={`my-3 overflow-hidden ${surfaceClass}`}>
      <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
        <div className="h-4 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800/80" />
      </div>
      <div className="flex h-[280px] items-end gap-2 px-6 pb-8 pt-6">
        {[38, 62, 44, 78, 52, 68, 48, 72, 58].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-slate-200/80 dark:bg-slate-800/80"
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
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 px-2.5 py-1 text-[11px] text-slate-400 dark:border-slate-800"
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
      <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#334155', strokeDasharray: '4 4' }} />
      {seriesNames.map((name, i) => (
        <Line
          key={name}
          type="monotone"
          dataKey={name}
          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
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
      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
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
  const summary = getSeriesSummary(input.series)

  return (
    <div className={`my-3 overflow-hidden ${surfaceClass}`}>
      <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Visualization
            </p>
            <h3 className="mt-1 text-sm font-medium leading-6 text-slate-800 dark:text-slate-100">
              {input.title}
            </h3>
            {summary && (
              <p className="mt-1 text-xs text-slate-500">
                Latest {summary.name}:{' '}
                <span className="font-medium tabular-nums text-slate-300">
                  {formatNumber(summary.latest)}
                </span>
                {' · '}
                Peak:{' '}
                <span className="font-medium tabular-nums text-slate-300">
                  {formatNumber(summary.peak)}
                </span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <span className="rounded-full border border-slate-100 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800">
              {style} chart
            </span>
            <SeriesLegend seriesNames={seriesNames} />
          </div>
        </div>
      </div>

      <div className="bg-slate-950/20 px-1 py-4 dark:bg-slate-950/40">
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
        <div className="border-t border-slate-100 px-4 py-2.5 text-center text-[11px] text-slate-500 dark:border-slate-800">
          {input.xAxis.title}
        </div>
      )}
    </div>
  )
}
