import { AlertTriangle, Check, Loader2, Search, Send } from 'lucide-react'
import { orderStage, type AdminCreditOrder, type OrderStage } from '../../lib/api/adminClient'
import { formatThb } from '../../lib/money'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import { STAGE_TONE } from './orderConstants'

export type TabKey = OrderStage

// Job-oriented stage labels (what the admin must DO). Which stages show as pills
// is decided by the parent main tab via the `stages` prop.
const TAB_LABEL: Record<TabKey, TKey> = {
  awaiting_payment: 'orev.tab.awaitingPayment',
  to_review: 'orev.tab.toReview',
  to_post: 'orev.tab.toPost',
  posted: 'orev.tab.posted',
  rejected: 'orev.tab.rejected',
}

// One-line hint under the tabs: tells the admin what this tab is for.
const HINT_KEY: Record<TabKey, TKey> = {
  awaiting_payment: 'orev.hint.awaitingPayment',
  to_review: 'orev.hint.toReview',
  to_post: 'orev.hint.toPost',
  posted: 'orev.hint.posted',
  rejected: 'orev.hint.rejected',
}

// Only the two action queues carry a count badge — the rest are informational.
const BADGE_TABS: ReadonlySet<TabKey> = new Set<TabKey>(['to_review', 'to_post'])

function companyOf(o: AdminCreditOrder): string {
  return o.buyer_name || o.tenant_name || '—'
}

interface Props {
  tab: TabKey
  stages: TabKey[]
  onTab: (t: TabKey) => void
  search: string
  onSearch: (s: string) => void
  orders: AdminCreditOrder[]
  counts: Record<string, number>
  loading: boolean
  selectedId: string | null
  onSelect: (o: AdminCreditOrder) => void
  // Batch posting (Paid tab only)
  checked: string[]
  onToggleCheck: (id: string) => void
  onPostBatch: () => void
  posting: boolean
}

export default function OrderQueue({
  tab,
  stages,
  onTab,
  search,
  onSearch,
  orders,
  counts,
  loading,
  selectedId,
  onSelect,
  checked,
  onToggleCheck,
  onPostBatch,
  posting,
}: Props) {
  const { t } = useT()
  const q = search.trim().toLowerCase()
  const visible = q ? orders.filter(o => companyOf(o).toLowerCase().includes(q)) : orders
  const batchMode = tab === 'to_post'

  return (
    <aside className="orev-queue" aria-label={t('orev.title')}>
      <div className="orev-queue-head">
        <h2 className="orev-queue-title">{t('orev.title')}</h2>
        <div className="orev-tabs" role="tablist" aria-label={t('orev.title')}>
          {stages.map(key => {
            const n = BADGE_TABS.has(key) ? (counts[key] ?? 0) : 0
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`orev-tab${tab === key ? ' is-active' : ''}`}
                onClick={() => onTab(key)}
              >
                {t(TAB_LABEL[key])}
                {n > 0 && <span className="orev-tab-count">{n}</span>}
              </button>
            )
          })}
        </div>
        <p className="orev-tab-hint">{t(HINT_KEY[tab])}</p>
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
        {batchMode && checked.length > 0 && (
          <button
            type="button"
            className="orev-post-batch"
            onClick={onPostBatch}
            disabled={posting}
          >
            {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {t('orev.inv.postBatch', { n: checked.length })}
          </button>
        )}
      </div>

      <div className="orev-list" aria-label={t('orev.title')}>
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
          visible.map(o => {
            const isChecked = checked.includes(o.id)
            return (
              <div key={o.id} className={`orev-item${selectedId === o.id ? ' is-selected' : ''}`}>
                {batchMode && (
                  <input
                    type="checkbox"
                    className="orev-item-check"
                    checked={isChecked}
                    onChange={() => onToggleCheck(o.id)}
                    aria-label={`select ${companyOf(o)}`}
                  />
                )}
                <button
                  type="button"
                  aria-current={selectedId === o.id || undefined}
                  className="orev-item-btn"
                  onClick={() => onSelect(o)}
                >
                  <span className={`orev-dot is-${STAGE_TONE[orderStage(o)]}`} aria-hidden="true" />
                  <span className="orev-item-main">
                    <span className="orev-item-company">{companyOf(o)}</span>
                    <span className="orev-item-sub">
                      {o.proforma_number ? `${o.proforma_number} · ` : ''}
                      {o.carmen_ar_code ? (
                        <span className="orev-ar-chip is-ok">
                          <Check size={10} /> {o.carmen_ar_code}
                        </span>
                      ) : (
                        <span className="orev-ar-chip is-warn">
                          <AlertTriangle size={10} /> {t('orev.inv.unmapped')}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="orev-item-amt">฿{formatThb(o.amount_thb)}</span>
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
