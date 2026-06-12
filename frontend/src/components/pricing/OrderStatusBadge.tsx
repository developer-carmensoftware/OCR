import Badge from '../common/Badge'
import type { OrderStatus } from '../../lib/api/credits'

const MAP: Record<
  OrderStatus,
  { variant: 'info' | 'warning' | 'success' | 'error' | 'gray'; label: string }
> = {
  pending: { variant: 'info', label: 'Awaiting payment' },
  awaiting_review: { variant: 'warning', label: 'Reviewing slip' },
  paid: { variant: 'success', label: 'Credited' },
  rejected: { variant: 'error', label: 'Slip rejected' },
  cancelled: { variant: 'gray', label: 'Cancelled' },
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { variant, label } = MAP[status] ?? MAP.pending
  return <Badge variant={variant}>{label}</Badge>
}
