import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Inbox } from 'lucide-react'
import OrderQueue from '../../components/admin/OrderQueue'
import OrderWorkspace from '../../components/admin/OrderWorkspace'
import {
  fetchAdminPaymentInfo,
  listCreditOrders,
  type AdminCreditOrder,
  type AdminOrderStatus,
} from '../../lib/api/adminClient'
import type { PaymentInfo } from '../../lib/api/credits'
import { useT } from '../../i18n/LanguageContext'
import '../../styles/pages/pricing.css'
import '../../styles/components/admin-credit-orders.css'

type TabKey = AdminOrderStatus | 'all'

export default function CreditOrdersPage() {
  const { t } = useT()
  const [tab, setTab] = useState<TabKey>('awaiting_review')
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<AdminCreditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminCreditOrder | null>(null)
  const [counts, setCounts] = useState({ awaiting_review: 0, on_hold: 0 })
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)

  const loadList = (t: TabKey) => {
    setLoading(true)
    listCreditOrders(t)
      .then(setOrders)
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }

  const refreshCounts = () => {
    Promise.all([listCreditOrders('awaiting_review'), listCreditOrders('on_hold')])
      .then(([a, h]) => setCounts({ awaiting_review: a.length, on_hold: h.length }))
      .catch(() => {})
  }

  useEffect(() => loadList(tab), [tab])
  useEffect(() => {
    refreshCounts()
    fetchAdminPaymentInfo()
      .then(setPaymentInfo)
      .catch(() => {})
  }, [])

  // After a decision: keep the just-decided order on screen, but refresh the list
  // (it may leave the active tab) and the queue badges.
  const onChanged = (updated: AdminCreditOrder) => {
    setSelected(updated)
    loadList(tab)
    refreshCounts()
  }

  return (
    <div className="orev-console">
      <OrderQueue
        tab={tab}
        onTab={setTab}
        search={search}
        onSearch={setSearch}
        orders={orders}
        counts={counts}
        loading={loading}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />
      <div className="orev-main">
        {selected ? (
          <OrderWorkspace order={selected} paymentInfo={paymentInfo} onChanged={onChanged} />
        ) : (
          <div className="orev-empty">
            <Inbox size={40} strokeWidth={1.5} aria-hidden="true" />
            <p className="orev-empty-title">{t('orev.empty.title')}</p>
            <p className="orev-empty-sub">{t('orev.empty.sub')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
