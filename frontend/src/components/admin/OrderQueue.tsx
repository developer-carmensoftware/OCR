import { Search } from 'lucide-react'
import type { AdminCreditOrder, AdminOrderStatus } from '../../lib/api/adminClient'
import { formatThb } from '../../lib/money'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'

/** Color role per order status (label comes from i18n — see STATUS_KEY). */
export const STATUS_TONE: Record<AdminOrderStatus, string> = {
  awaiting_review: 'wait',
  on_hold: 'hold',
  pending: 'idle',
  paid: 'ok',
  rejected: 'bad',
  cancelled: 'idle',
}

/** i18n key for each status label, shared with the workspace. */
export const STATUS_KEY: Record<AdminOrderStatus, TKey> = {
  awaiting_review: 'orev.status.awaiting_review',
  on_hold: 'orev.status.on_hold',
  pending: 'orev.status.pending',
  paid: 'orev.status.paid',
  rejected: 'orev.status.rejected',
  cancelled: 'orev.status.cancelled',
}

type TabKey = AdminOrderStatus | 'all'

const TABS: { key: TabKey; label: TKey }[] = [
  { key: 'awaiting_review', label: 'orev.tab.awaiting' },
  { key: 'on_hold', label: 'orev.tab.onHold' },
  { key: 'pending', label: 'orev.tab.pending' },
  { key: 'paid', label: 'orev.tab.approved' },
  { key: 'rejected', label: 'orev.tab.rejected' },
  { key: 'all', label: 'orev.tab.all' },
]

type T = (key: TKey, vars?: Record<string, string | number>) => string

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

function companyOf(o: AdminCreditOrder): string {
  return o.tenant_name ?? o.tenant_id?.slice(0, 8) ?? '—'
}

interface Props {
  tab: TabKey
  onTab: (t: TabKey) => void
  search: string
  onSearch: (s: string) => void
  orders: AdminCreditOrder[]
  counts: { awaiting_review: number; on_hold: number }
  loading: boolean
  selectedId: string | null
  onSelect: (o: AdminCreditOrder) => void
}

export default function OrderQueue({
  tab,
  onTab,
  search,
  onSearch,
  orders,
  counts,
  loading,
  selectedId,
  onSelect,
}: Props) {
  const { t } = useT()
  const q = search.trim().toLowerCase()
  const visible = q ? orders.filter(o => companyOf(o).toLowerCase().includes(q)) : orders

  return (
    <aside className="orev-queue" aria-label={t('orev.title')}>
      <div className="orev-queue-head">
        <h2 className="orev-queue-title">{t('orev.title')}</h2>
        <div className="orev-tabs" role="tablist" aria-label={t('orev.title')}>
          {TABS.map(tabDef => {
            const badge =
              tabDef.key === 'awaiting_review'
                ? counts.awaiting_review
                : tabDef.key === 'on_hold'
                  ? counts.on_hold
                  : null
            return (
              <button
                key={tabDef.key}
                type="button"
                role="tab"
                aria-selected={tab === tabDef.key}
                className={`orev-tab${tab === tabDef.key ? ' is-active' : ''}`}
                onClick={() => onTab(tabDef.key)}
              >
                {t(tabDef.label)}
                {badge ? <span className="orev-tab-badge">{badge}</span> : null}
              </button>
            )
          })}
        </div>
        <div className="orev-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={t('orev.search')}
            aria-label={t('orev.search')}
          />
        </div>
      </div>

      <div className="orev-list" role="listbox" aria-label={t('orev.title')}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="orev-item is-skeleton" aria-hidden="true">
              <span className="skeleton orev-sk-line" />
              <span className="skeleton orev-sk-line orev-sk-line--sm" />
            </div>
          ))
        ) : visible.length === 0 ? (
          <p className="orev-list-empty">{q ? t('orev.list.noMatch') : t('orev.list.empty')}</p>
        ) : (
          visible.map(o => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={selectedId === o.id}
              className={`orev-item${selectedId === o.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(o)}
            >
              <span className={`orev-dot is-${STATUS_TONE[o.status]}`} aria-hidden="true" />
              <span className="orev-item-main">
                <span className="orev-item-company">{companyOf(o)}</span>
                <span className="orev-item-sub">
                  {o.pack_code} · {timeAgo(o.slip_uploaded_at ?? o.created_at, t)}
                </span>
              </span>
              <span className="orev-item-amt">฿{formatThb(o.amount_thb)}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
