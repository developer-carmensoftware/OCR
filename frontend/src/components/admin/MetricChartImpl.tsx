// recharts is intentionally code-split: this module is only reached via
// React.lazy(() => import('./MetricChartImpl')) in MetricChart.tsx, so recharts
// already loads on demand in its own chunk — the static import here is fine.
// eslint-disable-next-line react-doctor/prefer-dynamic-import
import {
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
} from 'recharts'

type ChartType = 'line' | 'bar' | 'stacked-bar' | 'pie'

interface Series {
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

export default function MetricChart({
  type,
  data,
  series,
  xKey = 'date',
  height = 260,
  yFormatter,
  loading = false,
}: MetricChartProps) {
  const fmt = (v: unknown) => (yFormatter ? yFormatter(Number(v)) : String(v ?? ''))

  if (loading) {
    return <output className="skeleton skeleton-chart" aria-label="Loading chart…" />
  }

  if (!data || data.length === 0) {
    return <div className="chart-empty">No data for selected period</div>
  }

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
              <Cell
                key={entry.name}
                fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
              />
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
