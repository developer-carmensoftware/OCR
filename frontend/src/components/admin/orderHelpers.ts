import { type OrderStage } from '../../lib/api/adminClient'
import type { TKey } from '../../i18n/dict'

type T = (key: TKey, vars?: Record<string, string | number>) => string

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

// One-line hint under the tabs: tells the admin what this tab is for.
export function timeAgo(iso: string | null, t: T): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return '—'
  const m = Math.floor(ms / 60000)
  if (m < 1) return t('orev.time.justNow')
  if (m < 60) return t('orev.time.mAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('orev.time.hAgo', { n: h })
  return t('orev.time.dAgo', { n: Math.floor(h / 24) })
}
