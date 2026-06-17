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

const SERIES_COLORS = ['#8b5cf6', '#22d3ee', '#fbbf24', '#34d399', '#f472b6', '#fb923c']

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

function buildSeriesChartData(input) {
  const labels = input?.xAxis?.data ?? []
  const series = input?.series ?? []

  return labels.map((label, index) => {
    const point = { label }
    series.forEach((s) => {
      point[s.name] = s.values?.[index]
    })
    return point
  })
}

function buildScatterData(input) {
  const labels = input?.xAxis?.data ?? []

  return (input?.series ?? []).map((s) => ({
    name: s.name,
    points: (s.values ?? []).map((value, index) => ({
      x: index,
      y: value,
      label: labels[index] ?? String(index),
    })),
  }))
}

function ChartSkeleton({ title }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[#252839]" />
      </div>
      <div className="flex h-[260px] items-end gap-2 px-4 pb-8 pt-6">
        {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75].map((height, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-[#252839]"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      {title && (
        <p className="px-4 pb-3 text-xs text-gray-500">Building chart…</p>
      )}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-[#252839] bg-[#0d0f14] px-3 py-2 shadow-xl">
      <p className="mb-1 text-[11px] font-medium text-gray-400">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-xs"
          style={{ color: entry.color }}
        >
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  )
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-lg border border-[#252839] bg-[#0d0f14] px-3 py-2 shadow-xl">
      <p className="mb-1 text-[11px] font-medium text-gray-400">{point.label}</p>
      <p className="text-xs text-violet-300">{formatNumber(point.y)}</p>
    </div>
  )
}

function LineBarChart({ input }) {
  const data = buildSeriesChartData(input)
  const series = input.series ?? []
  const Chart = input.style === 'bar' ? BarChart : LineChart
  const isBar = input.style === 'bar'

  return (
    <ResponsiveContainer width="100%" height={280}>
      <Chart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#252839" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#252839' }}
          interval="preserveStartEnd"
          label={
            input.xAxis?.title
              ? { value: input.xAxis.title, position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }
              : undefined
          }
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatNumber}
          domain={[input.yAxis?.min ?? 'auto', input.yAxis?.max ?? 'auto']}
          label={
            input.yAxis?.title
              ? { value: input.yAxis.title, angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }
              : undefined
          }
        />
        <Tooltip content={<ChartTooltip />} />
        {series.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span className="text-gray-400">{value}</span>}
          />
        )}
        {series.map((s, index) => {
          const color = SERIES_COLORS[index % SERIES_COLORS.length]
          return isBar ? (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={color}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          ) : (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          )
        })}
      </Chart>
    </ResponsiveContainer>
  )
}

function ScatterPlotChart({ input }) {
  const scatterSeries = buildScatterData(input)
  const labels = input?.xAxis?.data ?? []

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#252839" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name="x"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#252839' }}
          domain={[0, Math.max(labels.length - 1, 0)]}
          ticks={labels.map((_, i) => i)}
          tickFormatter={(value) => labels[value] ?? value}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="y"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatNumber}
          domain={[input.yAxis?.min ?? 'auto', input.yAxis?.max ?? 'auto']}
          label={
            input.yAxis?.title
              ? { value: input.yAxis.title, angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }
              : undefined
          }
        />
        <Tooltip content={<ScatterTooltip />} />
        {scatterSeries.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span className="text-gray-400">{value}</span>}
          />
        )}
        {scatterSeries.map((s, index) => (
          <Scatter
            key={s.name}
            name={s.name}
            data={s.points}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default function ChartDisplayTool({ part }) {
  const input = part.input
  const isLoading =
    part.state === 'input-streaming' ||
    (part.state === 'input-available' && !input?.series?.length)

  if (isLoading) {
    return <ChartSkeleton title={input?.title} />
  }

  if (!input?.series?.length) {
    return null
  }

  const styleLabel = {
    line: 'Line chart',
    bar: 'Bar chart',
    scatter: 'Scatter chart',
  }[input.style] ?? 'Chart'

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-violet-400">
            {styleLabel}
          </p>
          <h3 className="mt-1 text-sm font-medium text-slate-100">{input.title}</h3>
        </div>
        <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-300">
          {input.series.length} series · {input.xAxis?.data?.length ?? input.series[0]?.values?.length ?? 0} points
        </span>
      </div>

      <div className="chart-canvas px-2 pb-2 pt-1">
        {input.style === 'scatter' ? (
          <ScatterPlotChart input={input} />
        ) : (
          <LineBarChart input={input} />
        )}
      </div>
    </div>
  )
}
