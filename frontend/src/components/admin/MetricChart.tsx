import { lazy, Suspense } from 'react'
import type { MetricChartProps } from './MetricChartImpl'

const LazyMetricChart = lazy(() => import('./MetricChartImpl'))

export default function MetricChart(props: MetricChartProps) {
  return (
    <Suspense fallback={<output className="skeleton skeleton-chart" aria-label="Loading chart…" />}>
      <LazyMetricChart {...props} />
    </Suspense>
  )
}
