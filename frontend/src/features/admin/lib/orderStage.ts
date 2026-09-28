/**
 * What the admin must do with an order, derived from (status + slip) — and how each
 * stage is drawn. Admin-only, so it lives with the dashboard rather than in shared/.
 */

import type { TKey } from '@/i18n/dict'
import type { AdminCreditOrder } from '@/features/admin/api/orders'

/**
 * Workflow stage = what the admin must DO, derived from (status + slip).
 * Backend keeps in_progress for both pre- and post-slip, so the slip flag splits it.
 */
export type OrderStage =
  'awaiting_payment' | 'to_review' | 'on_hold' | 'to_post' | 'posted' | 'rejected'

export function orderStage(o: AdminCreditOrder): OrderStage {
  switch (o.status) {
    case 'in_progress':
      return o.slip_uploaded_at ? 'to_review' : 'awaiting_payment'
    case 'on_hold':
      return 'on_hold'
    case 'paid':
      return 'to_post'
    case 'complete':
      return 'posted'
    case 'void':
      return 'rejected'
  }
}

// Dot/badge colour per workflow stage — the two action queues stand out (blue/amber).
export const STAGE_TONE: Record<OrderStage, string> = {
  awaiting_payment: 'idle',
  to_review: 'wait',
  on_hold: 'hold',
  to_post: 'hold',
  posted: 'ok',
  rejected: 'bad',
}

export const STAGE_KEY: Record<OrderStage, TKey> = {
  awaiting_payment: 'orev.tab.awaitingPayment',
  to_review: 'orev.tab.toReview',
  on_hold: 'orev.tab.onHold',
  to_post: 'orev.tab.toPost',
  posted: 'orev.tab.posted',
  rejected: 'orev.tab.rejected',
}
