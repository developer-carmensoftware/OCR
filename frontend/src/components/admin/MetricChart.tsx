import { lazy, Suspense } from 'react'
import type { MetricChartProps } from './MetricChartImpl'
import { useT } from '../../i18n/LanguageContext'

const LazyMetricChart = lazy(() => import('./MetricChartImpl'))

export default function MetricChart(props: MetricChartProps) {
  const { t } = useT()
  return (
    <Suspense
      fallback={
        <output
          className="skeleton skeleton-chart"
          aria-label={t('admin.common.chart.loadingAria')}
        />
      }
    >
      <LazyMetricChart {...props} />
    </Suspense>
  )
}
