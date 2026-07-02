import { AlertTriangle, Check, Pause, Search, Send, ThumbsUp, type LucideIcon } from 'lucide-react'
import { orderStage, type AdminCreditOrder, type OrderStage } from '../../lib/api/adminClient'
import { formatThb } from '../../lib/money'
import { formatDateToDDMMYYYY } from '../../lib/date'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import { STAGE_TONE } from './orderHelpers'
import BatchActionBar from './BatchActionBar'

// The unified table adds an `all` pseudo-stage on top of the six workflow stages.
export type TabKey = OrderStage | 'all'

const TAB_LABEL: Record<TabKey, TKey> = {
  all: 'orev.tab.all',
  awaiting_payment: 'orev.tab.awaitingPayment',
  to_review: 'orev.tab.toReview',
  on_hold: 'orev.tab.onHold',
  to_post: 'orev.tab.toPost',
  posted: 'orev.tab.posted',
  rejected: 'orev.tab.rejected',
}

const STAGE_LABEL: Record<OrderStage, TKey> = {
  awaiting_payment: 'orev.tab.awaitingPayment',
  to_review: 'orev.tab.toReview',
  on_hold: 'orev.tab.onHold',
  to_post: 'orev.tab.toPost',
  posted: 'orev.tab.posted',
  rejected: 'orev.tab.rejected',
}

// Only the action queues carry a count badge — the rest are informational.
const BADGE_TABS: ReadonlySet<TabKey> = new Set<TabKey>(['to_review', 'on_hold', 'to_post'])

// Every tab that supports action lists the bulk actions that apply to *every* row
// in it — checkbox + one button per action is the only way to act, whether on one
// row or many (check one row → "Approve (1)"). Reject isn't here: it needs a
// written, per-order reason (shown to the buyer), so it stays a drawer-only action.
// Hold only appears on To Review — On Hold rows are already parked.
type BatchAction = 'approve' | 'hold' | 'post'
const BATCH_ACTIONS_FOR_TAB: Partial<Record<TabKey, BatchAction[]>> = {
  to_review: ['approve', 'hold'],
  on_hold: ['approve'],
  to_post: ['post'],
}
const BATCH_BUTTON: Record<BatchAction, { icon: LucideIcon; labelKey: TKey; cls: string }> = {
  approve: { icon: ThumbsUp, labelKey: 'orev.inv.approveBatch', cls: 'btn-confirm' },
  hold: { icon: Pause, labelKey: 'orev.inv.holdBatch', cls: 'btn-outline' },
  post: { icon: Send, labelKey: 'orev.inv.postBatch', cls: 'btn-confirm' },
}

function companyOf(o: AdminCreditOrder): string {
  return o.buyer_name || o.tenant_name || '—'
}

// The date admins cross-check against their own bank statement: when the slip was
// attached, not when the order was first created. Falls back to the order date for
// awaiting-payment rows, which have no slip yet.
function paymentDate(o: AdminCreditOrder): string {
  const iso = o.slip_uploaded_at ?? o.created_at
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : formatDateToDDMMYYYY(d)
}

// A row can be checked when at least one bulk action applies to it. Approve/Hold
// don't depend on AR mapping; Post does — unmapped to_post rows show "Awaiting
// Mapping" in the AR Code column instead of a checkbox (fix the mapping via the
// drawer or the Customer Mapping tab).
function isCheckable(o: AdminCreditOrder, actions: BatchAction[]): boolean {
  if (actions.length === 0) return false
  if (actions.includes('post')) return !!o.carmen_ar_code
  return true
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
  // Row click opens the single deep-review drawer — the only way to see the slip
  // itself, the proforma, and order history; most day-to-day decisions don't need it.
  onSelect: (o: AdminCreditOrder) => void
  checked: string[]
  onToggleCheck: (id: string) => void
  onToggleAll: (ids: string[]) => void
  onClearChecked: () => void
  onApproveBatch: () => void
  onHoldBatch: () => void
  onPostBatch: () => void
  busy: boolean
}

export default function OrderTable({
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
  onToggleAll,
  onClearChecked,
  onApproveBatch,
  onHoldBatch,
  onPostBatch,
  busy,
}: Props) {
  const { t } = useT()
  const q = search.trim().toLowerCase()
  const visible = q ? orders.filter(o => companyOf(o).toLowerCase().includes(q)) : orders
  const batchActions = BATCH_ACTIONS_FOR_TAB[tab] ?? []
  const checkableIds = visible.filter(o => isCheckable(o, batchActions)).map(o => o.id)
  const allChecked = checkableIds.length > 0 && checkableIds.every(id => checked.includes(id))
  const RUN: Record<BatchAction, () => void> = {
    approve: onApproveBatch,
    hold: onHoldBatch,
    post: onPostBatch,
  }

  return (
    <section className="orev-tablewrap" aria-label={t('orev.title')}>
      <div className="orev-table-toolbar">
        <div className="orev-table-heading">
          <h2 className="orev-queue-title">{t('orev.inv.heading')}</h2>
          <p className="orev-tab-hint">{t('orev.inv.sub')}</p>
        </div>
        <div className="orev-table-controls">
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
      </div>

      <BatchActionBar
        count={checked.length}
        busy={busy}
        onClear={onClearChecked}
        actions={batchActions.map(action => ({
          key: action,
          icon: BATCH_BUTTON[action].icon,
          labelKey: BATCH_BUTTON[action].labelKey,
          cls: BATCH_BUTTON[action].cls,
          onRun: RUN[action],
        }))}
      />

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

      <div className="orev-table-scroll">
        <table className="orev-table">
          <thead>
            <tr>
              <th className="orev-th-check">
                {checkableIds.length > 0 && (
                  <input
                    type="checkbox"
                    className="orev-item-check"
                    checked={allChecked}
                    onChange={() => onToggleAll(checkableIds)}
                    aria-label={t('orev.selectAll')}
                  />
                )}
              </th>
              <th>{t('orev.col.proforma')}</th>
              <th>{t('orev.col.company')}</th>
              <th>{t('orev.col.date')}</th>
              <th>{t('orev.col.desc')}</th>
              <th className="orev-col-amt">{t('orev.col.amount')}</th>
              <th>{t('orev.col.status')}</th>
              <th>{t('orev.col.arCode')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="orev-row is-skeleton" aria-hidden="true">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j}>
                      <span className="skeleton orev-sk-cell" />
                    </td>
                  ))}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="orev-list-empty">
                  {q ? t('orev.list.noMatch') : t('orev.list.empty')}
                </td>
              </tr>
            ) : (
              visible.map(o => {
                const stage = orderStage(o)
                const isChecked = checked.includes(o.id)
                return (
                  <tr
                    key={o.id}
                    className={`orev-row${selectedId === o.id ? ' is-selected' : ''}`}
                    aria-current={selectedId === o.id || undefined}
                    onClick={() => onSelect(o)}
                  >
                    <td className="orev-td-check" onClick={e => e.stopPropagation()}>
                      {isCheckable(o, batchActions) && (
                        <input
                          type="checkbox"
                          className="orev-item-check"
                          checked={isChecked}
                          onChange={() => onToggleCheck(o.id)}
                          aria-label={`select ${companyOf(o)}`}
                        />
                      )}
                    </td>
                    <td className="mono">{o.proforma_number || '—'}</td>
                    <td className="orev-td-company">{companyOf(o)}</td>
                    <td className="mono">{paymentDate(o)}</td>
                    <td className="orev-td-desc">
                      {o.pack_code} · {t('orev.credits', { n: o.credits.toLocaleString() })}
                    </td>
                    <td className="orev-col-amt mono">฿{formatThb(o.amount_thb)}</td>
                    <td>
                      <span className={`orev-badge is-${STAGE_TONE[stage]}`}>
                        {t(STAGE_LABEL[stage])}
                      </span>
                    </td>
                    <td>
                      {o.carmen_ar_code ? (
                        <span className="orev-ar-chip is-ok">
                          <Check size={11} /> {o.carmen_ar_code}
                        </span>
                      ) : (
                        <span className="orev-ar-chip is-warn">
                          <AlertTriangle size={11} /> {t('orev.inv.unmapped')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
