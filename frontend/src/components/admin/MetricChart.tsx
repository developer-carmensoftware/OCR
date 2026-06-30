import { useEffect, useState } from 'react'

export type ChartType = 'line' | 'bar' | 'stacked-bar' | 'pie'

export interface Series {
  key: string
  label: string
  color: string
}

export interface MetricChartProps {
  type: ChartType
  data: Record<string, unknown>[]
  series: Series[]
  xKey?: string
  height?: number
  yFormatter?: (v: number) => string
  loading?: boolean
}

const FALLBACK_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa']

// recharts (+ d3) is heavy, so we never import it statically — it would ship in
// the main bundle to every user, including those who never open a chart. Instead
// we load it on demand the first time a chart renders; until the chunk arrives we
// show the loading skeleton. `typeof import(...)` is an inline type query, not a
// static import, so no recharts code is pulled in eagerly.
type Recharts = Awaited<typeof import('recharts')>

export default function MetricChart({
  type,
  data,
  series,
  xKey = 'date',
  height = 260,
  yFormatter,
  loading = false,
}: MetricChartProps) {
  const [RC, setRC] = useState<Recharts | null>(null)

  useEffect(() => {
    let alive = true
    import('recharts').then(m => {
      if (alive) setRC(m)
    })
    return () => {
      alive = false
    }
  }, [])

  const fmt = (v: unknown) => (yFormatter ? yFormatter(Number(v)) : String(v ?? ''))

  if (loading || !RC) {
    return (
      <output className="skeleton skeleton-chart" aria-label="Loading chart…" style={{ height }} />
    )
  }

  if (!data || data.length === 0) {
    return <div className="chart-empty">No data for selected period</div>
  }

  const {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
  } = RC

  if (type === 'pie') {
    const pieData = series.map(s => ({
      name: s.label,
      value: data.reduce((sum, row) => sum + Number(row[s.key] ?? 0), 0),
      color: s.color,
    }))
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={fmt as never} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #e5e7eb)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={56} />
          <Tooltip formatter={fmt as never} />
          {series.length > 1 && <Legend />}
          {series.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // bar or stacked-bar
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #e5e7eb)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={56} />
        <Tooltip formatter={fmt as never} />
        {series.length > 1 && <Legend />}
        {series.map(s => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={type === 'stacked-bar' ? 'stack' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
