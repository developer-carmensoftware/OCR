import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Building2, FileText } from 'lucide-react'
import OrderTable, { type TabKey } from '../../components/admin/OrderTable'
import OrderDrawer from '../../components/admin/OrderDrawer'
import OrderKpiCards from '../../components/admin/OrderKpiCards'
import ArCustomerProfiles from '../../components/admin/ArCustomerProfiles'
import {
  approveOrder,
  fetchAdminPaymentInfo,
  fetchKpi,
  holdBatch,
  listCreditOrders,
  postArBatch,
  type AdminCreditOrder,
  type AdminOrderStatus,
  type KpiSummary,
} from '../../lib/api/adminClient'
import type { PaymentInfo } from '../../lib/api/credits'
import { useT } from '../../i18n/LanguageContext'
import '../../styles/pages/pricing.css'
import '../../styles/components/admin-credit-orders.css'

// Two main tabs: the unified Orders table (all statuses) + Customer Mapping.
type MainTab = 'orders' | 'mapping'

// All six workflow stages live in one filter bar, defaulting to "All".
const STAGES: TabKey[] = [
  'all',
  'awaiting_payment',
  'to_review',
  'on_hold',
  'to_post',
  'posted',
  'rejected',
]

// Each stage maps to a (status, slip) query — in_progress splits by slip.
const STAGE_QUERY: Record<TabKey, { status: AdminOrderStatus | 'all'; hasSlip?: boolean }> = {
  all: { status: 'all' },
  awaiting_payment: { status: 'in_progress', hasSlip: false },
  to_review: { status: 'in_progress', hasSlip: true },
  on_hold: { status: 'on_hold' },
  to_post: { status: 'paid' },
  posted: { status: 'complete' },
  rejected: { status: 'void' },
}

export default function CreditOrdersPage() {
  const { t } = useT()
  const [mainTab, setMainTab] = useState<MainTab>('orders')
  const [workflowTab, setWorkflowTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<AdminCreditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminCreditOrder | null>(null)
  const [kpi, setKpi] = useState<KpiSummary | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  // Shared by every table-level bulk action (approve, hold, post) — only the
  // actions valid for the current tab are ever offered at once, so one flag is
  // enough to guard overlapping submits.
  const [busy, setBusy] = useState(false)

  // Reload the current stage; when `preferIds` is given, re-point `selected` at the
  // fresh (enriched) row so the drawer keeps proforma_number / carmen_ar_code — or
  // closes if the order left this stage after an action.
  // ponytail: All tab fetches every order; add server pagination if history grows large.
  const loadList = (wt: TabKey, preferIds: (string | undefined)[] = []) => {
    setLoading(true)
    const q = STAGE_QUERY[wt]
    listCreditOrders(q.status, undefined, q.hasSlip)
      .then(rows => {
        setOrders(rows)
        if (preferIds.length) {
          const pick = preferIds.map(id => rows.find(o => o.id === id)).find(Boolean)
          setSelected(pick ?? null)
        }
      })
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }

  const refreshKpi = () => {
    fetchKpi()
      .then(setKpi)
      .catch(() => {})
  }

  useEffect(() => {
    setChecked([])
    loadList(workflowTab)
  }, [workflowTab])
  useEffect(() => {
    refreshKpi()
    fetchAdminPaymentInfo()
      .then(setPaymentInfo)
      .catch(() => {})
  }, [])

  // After approve/reject/post the order leaves its stage → the drawer closes; after a
  // note save it stays, so re-point at the fresh row keeps the drawer open on it.
  const onChanged = (updated?: AdminCreditOrder) => {
    loadList(workflowTab, [updated?.id])
    refreshKpi()
  }

  const toggleCheck = (id: string) =>
    setChecked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  // Select/deselect every given id in one go — backs the table's header checkbox.
  const toggleAll = (ids: string[]) =>
    setChecked(prev => (ids.every(id => prev.includes(id)) ? [] : ids))

  // Shared cleanup after any bulk/inline table action: drop the acted-on ids from
  // the selection, refresh the list (re-pointing the open drawer only if it was one
  // of the acted-on orders — it'll have left the stage, so the drawer auto-closes),
  // and refresh the KPI counts.
  const afterBulkAction = (ids: string[]) => {
    setChecked(prev => prev.filter(id => !ids.includes(id)))
    loadList(workflowTab, selected && ids.includes(selected.id) ? [selected.id] : [])
    refreshKpi()
  }

  // The one place that posts orders to Carmen AR — used by the inline row Post
  // button, the batch bar, and the drawer's "Post to AR" button alike, so there is
  // exactly one network call + refresh + toast implementation for posting, whether
  // it's 1 order or many.
  const postOrders = async (ids: string[]) => {
    if (ids.length === 0) return
    setBusy(true)
    try {
      const { results } = await postArBatch(ids)
      const ok = results.filter(r => r.success).length
      const fail = results.length - ok
      if (ids.length === 1) {
        if (ok) toast.success(t('orev.toast.posted'))
        else toast.error(results[0]?.error || 'AR posting failed')
      } else {
        toast[fail ? 'warning' : 'success'](t('orev.toast.postedSummary', { ok, fail }))
      }
      afterBulkAction(ids)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // The one place that approves orders — used by the inline row Approve button and
  // the batch bar on the To Review / On Hold tabs. Deliberately no confirmation
  // step: the admin checks the amount/date against their own bank statement before
  // checking a row, so the table itself is the "are you sure" (unlike the two-tap
  // Approve inside the deep-review drawer, which is the only-click-you-get path).
  // No batch-approve endpoint exists, so this fires one request per order.
  const approveOrders = async (ids: string[]) => {
    if (ids.length === 0) return
    setBusy(true)
    try {
      const settled = await Promise.allSettled(ids.map(approveOrder))
      const okResults = settled.filter(
        (r): r is PromiseFulfilledResult<AdminCreditOrder> => r.status === 'fulfilled'
      )
      const fail = settled.length - okResults.length
      if (ids.length === 1) {
        if (okResults.length) {
          toast.success(
            t('orev.toast.approved', { n: okResults[0].value.credits.toLocaleString() })
          )
        } else {
          const rejected = settled[0] as PromiseRejectedResult
          toast.error((rejected.reason as Error)?.message || 'Approve failed')
        }
      } else {
        toast[fail ? 'warning' : 'success'](
          t('orev.toast.approvedSummary', { ok: okResults.length, fail })
        )
      }
      afterBulkAction(ids)
    } finally {
      setBusy(false)
    }
  }

  // The one place that parks orders on_hold — a manual, on-demand version of the
  // hourly expiry sweep, for To Review rows the admin wants to set aside today
  // rather than wait 14 days for the cron. Uses the real batch endpoint (one
  // request either way), unlike approveOrders which has no batch endpoint yet.
  const holdOrders = async (ids: string[]) => {
    if (ids.length === 0) return
    setBusy(true)
    try {
      const { results } = await holdBatch(ids)
      const ok = results.filter(r => r.success).length
      const fail = results.length - ok
      if (ids.length === 1) {
        if (ok) toast.success(t('orev.toast.held'))
        else toast.error(results[0]?.error || 'Hold failed')
      } else {
        toast[fail ? 'warning' : 'success'](t('orev.toast.heldSummary', { ok, fail }))
      }
      afterBulkAction(ids)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="orev-page">
      <OrderKpiCards kpi={kpi} />

      {/* Main tab bar — the orders table + customer mapping */}
      <div className="orev-main-tabs">
        <button
          type="button"
          className={`orev-main-tab ${mainTab === 'orders' ? 'active' : ''}`}
          onClick={() => setMainTab('orders')}
        >
          <FileText size={15} />
          <span>{t('orev.mainTab.orders')}</span>
        </button>
        <button
          type="button"
          className={`orev-main-tab ${mainTab === 'mapping' ? 'active' : ''}`}
          onClick={() => setMainTab('mapping')}
        >
          <Building2 size={15} />
          <span>{t('orev.mainTab.mapping')}</span>
          {kpi && kpi.unmapped_count > 0 && (
            <span
              className="orev-tab-badge"
              title={t('orev.badge.unmappedTip', { n: kpi.unmapped_count })}
            >
              {t('orev.badge.unmapped', { n: kpi.unmapped_count })}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {mainTab === 'mapping' ? (
        <ArCustomerProfiles
          onMapped={() => {
            refreshKpi()
            loadList(workflowTab, [selected?.id])
          }}
        />
      ) : (
        <>
          <OrderTable
            tab={workflowTab}
            stages={STAGES}
            onTab={setWorkflowTab}
            search={search}
            onSearch={setSearch}
            orders={orders}
            counts={kpi?.status_counts ?? {}}
            loading={loading}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            checked={checked}
            onToggleCheck={toggleCheck}
            onToggleAll={toggleAll}
            onClearChecked={() => setChecked([])}
            onApproveBatch={() => approveOrders(checked)}
            onHoldBatch={() => holdOrders(checked)}
            onPostBatch={() => postOrders(checked)}
            busy={busy}
          />
          <OrderDrawer
            order={selected}
            paymentInfo={paymentInfo}
            onClose={() => setSelected(null)}
            onChanged={onChanged}
            onMapAr={() => setMainTab('mapping')}
            onPostOne={o => postOrders([o.id])}
            posting={busy}
          />
        </>
      )}
    </div>
  )
}
