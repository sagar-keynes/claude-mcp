import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const SERIES_COLORS = [
  '#8b5cf6',
  '#22d3ee',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#fb7185',
]

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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-[#2a2f42] bg-[#0d0f14]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-medium text-gray-400">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center gap-2 text-xs text-slate-200"
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="font-medium tabular-nums">
            {formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#252839] bg-[#11141c]">
      <div className="border-b border-[#252839] px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-[#1e2130]" />
      </div>
      <div className="flex h-[260px] items-end gap-2 px-6 pb-8 pt-6">
        {[40, 65, 45, 80, 55, 70, 50, 85, 60].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-gradient-to-t from-violet-900/40 to-violet-600/20"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function LineChartView({ data, seriesNames, yAxisTitle }) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
      <CartesianGrid stroke="#252839" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: '#6b7280', fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: '#252839' }}
        interval="preserveStartEnd"
      />
      <YAxis
        tick={{ fill: '#6b7280', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatNumber}
        label={
          yAxisTitle
            ? {
                value: yAxisTitle,
                angle: -90,
                position: 'insideLeft',
                fill: '#6b7280',
                fontSize: 11,
              }
            : undefined
        }
      />
      <Tooltip content={<ChartTooltip />} />
      {seriesNames.length > 1 && (
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }}
        />
      )}
      {seriesNames.map((name, i) => (
        <Line
          key={name}
          type="monotone"
          dataKey={name}
          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
          strokeWidth={2}
          dot={{ r: 3, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
          activeDot={{ r: 5 }}
        />
      ))}
    </LineChart>
  )
}

function BarChartView({ data, seriesNames, yAxisTitle }) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
      <CartesianGrid stroke="#252839" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: '#6b7280', fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: '#252839' }}
        interval="preserveStartEnd"
      />
      <YAxis
        tick={{ fill: '#6b7280', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatNumber}
        label={
          yAxisTitle
            ? {
                value: yAxisTitle,
                angle: -90,
                position: 'insideLeft',
                fill: '#6b7280',
                fontSize: 11,
              }
            : undefined
        }
      />
      <Tooltip content={<ChartTooltip />} />
      {seriesNames.length > 1 && (
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }}
        />
      )}
      {seriesNames.map((name, i) => (
        <Bar
          key={name}
          dataKey={name}
          fill={SERIES_COLORS[i % SERIES_COLORS.length]}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
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
    <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
      <CartesianGrid stroke="#252839" strokeDasharray="3 3" />
      <XAxis
        type="number"
        dataKey="x"
        name="Index"
        tick={{ fill: '#6b7280', fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: '#252839' }}
        tickFormatter={(v) => data[v]?.label ?? v}
      />
      <YAxis
        type="number"
        dataKey="y"
        tick={{ fill: '#6b7280', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatNumber}
        label={
          yAxisTitle
            ? {
                value: yAxisTitle,
                angle: -90,
                position: 'insideLeft',
                fill: '#6b7280',
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
            <div className="rounded-lg border border-[#2a2f42] bg-[#0d0f14]/95 px-3 py-2 shadow-xl">
              <p className="text-[11px] text-gray-400">{point?.label}</p>
              <p className="text-xs font-medium tabular-nums text-slate-200">
                {formatNumber(point?.y)}
              </p>
            </div>
          )
        }}
      />
      {scatterData.length > 1 && (
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }}
        />
      )}
      {scatterData.map(({ name, color, points }) => (
        <Scatter
          key={name}
          name={name}
          data={points}
          fill={color}
        />
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

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#252839] bg-[#11141c] shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between border-b border-[#252839] bg-gradient-to-r from-violet-950/30 to-transparent px-4 py-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-400">
            Chart
          </div>
          <h3 className="mt-0.5 text-sm font-medium text-slate-100">
            {input.title}
          </h3>
        </div>
        <span className="rounded-full border border-violet-800/50 bg-violet-950/40 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">
          {style}
        </span>
      </div>

      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={260}>
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
        <div className="border-t border-[#252839] px-4 py-2 text-center text-[11px] text-gray-500">
          {input.xAxis.title}
        </div>
      )}
    </div>
  )
}
