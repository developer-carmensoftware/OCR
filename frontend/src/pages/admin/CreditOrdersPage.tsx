import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Building2, FileText, Inbox, Send } from 'lucide-react'
import OrderQueue from '../../components/admin/OrderQueue'
import OrderWorkspace from '../../components/admin/OrderWorkspace'
import OrderKpiCards from '../../components/admin/OrderKpiCards'
import ArCustomerProfiles from '../../components/admin/ArCustomerProfiles'
import {
  fetchAdminPaymentInfo,
  fetchKpi,
  listCreditOrders,
  postArBatch,
  type AdminCreditOrder,
  type AdminOrderStatus,
  type KpiSummary,
  type OrderStage,
} from '../../lib/api/adminClient'
import type { PaymentInfo } from '../../lib/api/credits'
import { useT } from '../../i18n/LanguageContext'
import '../../styles/pages/pricing.css'
import '../../styles/components/admin-credit-orders.css'

// 3 main tabs, one per admin job. mapping is last (least frequent).
type MainTab = 'verify' | 'post' | 'mapping'
type WorkflowTab = OrderStage

// Stage pills shown per main tab + the stage it opens on.
const TAB_STAGES: Record<'verify' | 'post', WorkflowTab[]> = {
  verify: ['to_review', 'awaiting_payment', 'rejected'],
  post: ['to_post', 'posted'],
}
const DEFAULT_STAGE: Record<'verify' | 'post', WorkflowTab> = {
  verify: 'to_review',
  post: 'to_post',
}

// Each stage maps to a (status, slip) query — in_progress splits by slip.
const STAGE_QUERY: Record<WorkflowTab, { status: AdminOrderStatus | 'all'; hasSlip?: boolean }> = {
  awaiting_payment: { status: 'in_progress', hasSlip: false },
  to_review: { status: 'in_progress', hasSlip: true },
  to_post: { status: 'paid' },
  posted: { status: 'complete' },
  rejected: { status: 'void' },
}

export default function CreditOrdersPage() {
  const { t } = useT()
  const [mainTab, setMainTab] = useState<MainTab>('verify')
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>('to_review')
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<AdminCreditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminCreditOrder | null>(null)
  const [kpi, setKpi] = useState<KpiSummary | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [posting, setPosting] = useState(false)

  // Reload the list; keep `selected` in sync with the fresh (enriched) row so the
  // workspace always has proforma_number / carmen_ar_code.
  const loadList = (wt: WorkflowTab, keepId?: string) => {
    setLoading(true)
    const q = STAGE_QUERY[wt]
    listCreditOrders(q.status, undefined, q.hasSlip)
      .then(rows => {
        setOrders(rows)
        if (keepId) setSelected(rows.find(o => o.id === keepId) ?? null)
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

  const onChanged = (_updated: AdminCreditOrder) => {
    // After approve/reject/post the order moves to a different stage and leaves
    // the current tab. Clear selection immediately so the UI doesn't flash the
    // old workspace while reloading.
    setSelected(null)
    loadList(workflowTab)
    refreshKpi()
  }

  // Switching to verify/post opens that tab on its default stage.
  const selectMainTab = (m: MainTab) => {
    setMainTab(m)
    if (m !== 'mapping') setWorkflowTab(DEFAULT_STAGE[m])
  }

  const toggleCheck = (id: string) =>
    setChecked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const postBatch = async () => {
    if (checked.length === 0) return
    setPosting(true)
    try {
      const { results } = await postArBatch(checked)
      const ok = results.filter(r => r.success).length
      const fail = results.length - ok
      toast[fail ? 'warning' : 'success'](t('orev.toast.postedSummary', { ok, fail }))
      setChecked([])
      loadList(workflowTab)
      refreshKpi()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="orev-page">
      <OrderKpiCards kpi={kpi} />

      {/* Main tab bar — one per admin job */}
      <div className="orev-main-tabs">
        <button
          type="button"
          className={`orev-main-tab ${mainTab === 'verify' ? 'active' : ''}`}
          onClick={() => selectMainTab('verify')}
        >
          <FileText size={15} />
          <span>{t('orev.mainTab.verify')}</span>
          {kpi && kpi.to_review_count > 0 && (
            <span
              className="orev-tab-badge"
              title={t('orev.badge.toReviewTip', { n: kpi.to_review_count })}
            >
              {t('orev.badge.toReview', { n: kpi.to_review_count })}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`orev-main-tab ${mainTab === 'post' ? 'active' : ''}`}
          onClick={() => selectMainTab('post')}
        >
          <Send size={15} />
          <span>{t('orev.mainTab.post')}</span>
          {kpi && kpi.to_post_count > 0 && (
            <span
              className="orev-tab-badge"
              title={t('orev.badge.toPostTip', { n: kpi.to_post_count })}
            >
              {t('orev.badge.toPost', { n: kpi.to_post_count })}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`orev-main-tab ${mainTab === 'mapping' ? 'active' : ''}`}
          onClick={() => selectMainTab('mapping')}
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
          }}
        />
      ) : (
        <div className="orev-console">
          <OrderQueue
            tab={workflowTab}
            stages={TAB_STAGES[mainTab]}
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
            onPostBatch={postBatch}
            posting={posting}
          />
          <div className="orev-main">
            {selected ? (
              <OrderWorkspace
                order={selected}
                paymentInfo={paymentInfo}
                onChanged={onChanged}
                onMapAr={() => selectMainTab('mapping')}
              />
            ) : (
              <div className="orev-empty">
                <Inbox size={40} strokeWidth={1.5} aria-hidden="true" />
                {(kpi?.status_counts?.[workflowTab] ?? 0) > 0 ? (
                  <>
                    <p className="orev-empty-title">{t('orev.empty.title')}</p>
                    <p className="orev-empty-sub">
                      {t('orev.empty.hasQueue', { n: kpi!.status_counts[workflowTab] })}
                    </p>
                  </>
                ) : (
                  <p className="orev-empty-title">{t('orev.empty.allClear')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
