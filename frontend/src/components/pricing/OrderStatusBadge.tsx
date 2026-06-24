import Badge from '../common/Badge'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import type { OrderStatus } from '../../lib/api/credits'

const MAP: Record<
  OrderStatus,
  { variant: 'info' | 'warning' | 'success' | 'error' | 'gray'; key: TKey }
> = {
  in_progress: { variant: 'info', key: 'order.statusInProgress' },
  paid: { variant: 'success', key: 'order.statusPaid' },
  complete: { variant: 'success', key: 'order.statusComplete' },
  void: { variant: 'error', key: 'order.statusVoid' },
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT()
  const { variant, key } = MAP[status] ?? MAP.in_progress
  return <Badge variant={variant}>{t(key)}</Badge>
}
