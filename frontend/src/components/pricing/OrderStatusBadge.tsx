import Badge from '../common/Badge'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import type { OrderStatus } from '../../lib/api/credits'

const MAP: Record<
  OrderStatus,
  { variant: 'info' | 'warning' | 'success' | 'error' | 'gray'; key: TKey }
> = {
  pending: { variant: 'info', key: 'order.statusPending' },
  awaiting_review: { variant: 'warning', key: 'order.statusReviewing' },
  on_hold: { variant: 'warning', key: 'order.statusReviewing' },
  paid: { variant: 'success', key: 'order.statusPaid' },
  rejected: { variant: 'error', key: 'order.statusRejected' },
  cancelled: { variant: 'gray', key: 'order.statusCancelled' },
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT()
  const { variant, key } = MAP[status] ?? MAP.pending
  return <Badge variant={variant}>{t(key)}</Badge>
}
