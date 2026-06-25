import type { TKey } from '../../i18n/dict'
import { type OrderStage } from '../../lib/api/adminClient'

// Dot/badge colour per workflow stage — the two action queues stand out (blue/amber).
export const STAGE_TONE: Record<OrderStage, string> = {
  awaiting_payment: 'idle',
  to_review: 'wait',
  to_post: 'hold',
  posted: 'ok',
  rejected: 'bad',
}

export const STAGE_KEY: Record<OrderStage, TKey> = {
  awaiting_payment: 'orev.tab.awaitingPayment',
  to_review: 'orev.tab.toReview',
  to_post: 'orev.tab.toPost',
  posted: 'orev.tab.posted',
  rejected: 'orev.tab.rejected',
}
