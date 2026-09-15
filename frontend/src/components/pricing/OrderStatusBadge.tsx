import Badge from '../common/Badge'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import type { OrderStatus } from '../../lib/api/credits'

// paid and complete deliberately share a key: `complete` is the admin's AR-posting
// queue state (post_ar_batch), invisible to the customer, whose order is already
// done at `paid`. Do not split these back apart — see CLAUDE.md.
const MAP: Record<
  OrderStatus,
  { variant: 'info' | 'warning' | 'success' | 'error' | 'gray'; key: TKey }
> = {
  in_progress: { variant: 'info', key: 'order.statusInProgress' },
  on_hold: { variant: 'warning', key: 'order.statusOnHold' },
  paid: { variant: 'success', key: 'order.statusComplete' },
  complete: { variant: 'success', key: 'order.statusComplete' },
  void: { variant: 'error', key: 'order.statusVoid' },
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT()
  const { variant, key } = MAP[status] ?? MAP.in_progress
  return <Badge variant={variant}>{t(key)}</Badge>
}
