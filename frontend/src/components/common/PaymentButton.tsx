import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { Wallet, X, Coins, Check } from 'lucide-react'
import { getUsage } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import { getCreditPacks, createCreditOrder, type CreditPack } from '../../lib/api/credits'
import '../../styles/components/header-modals.css'
import type { UsageData } from '../../lib/api/auth'

const SUPPORT_EMAIL = 'support@carmen-cloud.com'

export default function PaymentButton() {
  const [open, setOpen] = useState(false)
  const [usage, setUsage] = useState<UsageData['usage'] | null>(null)
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [loading, setLoading] = useState(false)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [orderedPack, setOrderedPack] = useState<string | null>(null)

  const handleOpen = async () => {
    setOpen(true)
    setLoading(true)
    setOrderedPack(null)
    try {
      const token = getStoredToken()
      if (token) {
        const [u, p] = await Promise.all([getUsage(token), getCreditPacks().catch(() => [])])
        setUsage(u.usage)
        setPacks(p)
      }
    } catch {
      /* non-critical — modal still opens */
    } finally {
      setLoading(false)
    }
  }

  // Allow other parts of the app (e.g. a 402 on extraction) to open this modal.
  useEffect(() => {
    const onOpen = () => {
      void handleOpen()
    }
    window.addEventListener('ocr:open-topup', onOpen)
    return () => window.removeEventListener('ocr:open-topup', onOpen)
  }, [])

  const handleClose = () => {
    setOpen(false)
    setUsage(null)
    setPacks([])
    setOrderedPack(null)
  }

  const handleRequest = async (pack: CreditPack) => {
    setRequesting(pack.code)
    try {
      const order = await createCreditOrder(pack.code)
      setOrderedPack(pack.code)
      const subject = encodeURIComponent(`Credit top-up request — ${pack.credits} credits`)
      const body = encodeURIComponent(
        `Hi, I would like to top up ${pack.credits} credits (฿${pack.price_thb}).\nOrder ID: ${order.id}`
      )
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
    } catch {
      /* surfaced via the requesting reset below */
    } finally {
      setRequesting(null)
    }
  }

  const usedPct =
    usage && usage.max_monthly_calls > 0
      ? Math.min(100, (usage.monthly_calls / usage.max_monthly_calls) * 100)
      : 0

  const isLow = usage ? usage.remaining_calls <= 5 || usedPct >= 90 : false
  const barColor = usedPct >= 90 ? 'var(--rose)' : usedPct >= 70 ? 'var(--amber)' : 'var(--teal)'

  return (
    <>
      <button
        type="button"
        className="btn-icon"
        title="Plan & credits"
        onClick={() => {
          void handleOpen()
        }}
      >
        <Wallet size={15} strokeWidth={2} />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div className="hm-overlay" role="dialog" aria-modal="true" aria-label="Plan & Credits">
            <div className="hm-backdrop" onClick={handleClose} />
            <div className="hm-dialog">
              <div className="hm-header">
                <Wallet size={15} className="hm-header-icon" strokeWidth={2} />
                <span className="hm-header-title">Plan &amp; Credits</span>
                <button type="button" className="hm-close" onClick={handleClose} aria-label="Close">
                  <X size={14} />
                </button>
              </div>

              <div className="hm-body">
                {loading ? (
                  <div className="hm-plan-card hm-plan-card--loading">
                    <div className="hm-plan-row">
                      <span className="hm-plan-row-label">Loading…</span>
                    </div>
                  </div>
                ) : usage ? (
                  <div className="hm-plan-card">
                    <div className="hm-plan-row">
                      <span className="hm-plan-row-label">Free used this month</span>
                      <span className="hm-plan-row-value">
                        {usage.monthly_calls} / {usage.max_monthly_calls}
                      </span>
                    </div>
                    <div className="hm-plan-row">
                      <span className="hm-plan-row-label">Free remaining</span>
                      <span
                        className={`hm-plan-row-value${isLow ? ' hm-plan-row-value--low' : ''}`}
                      >
                        {usage.remaining_calls}
                      </span>
                    </div>
                    <div className="hm-progress-bar">
                      <div
                        className="hm-progress-fill"
                        style={{ width: `${usedPct}%`, background: barColor }}
                      />
                    </div>
                    <div className="hm-plan-row">
                      <span className="hm-plan-row-label">
                        <Coins size={12} className="hm-coins-icon" />
                        Top-up credits
                      </span>
                      <span className="hm-plan-row-value">{usage.credit_balance}</span>
                    </div>
                  </div>
                ) : (
                  <div className="hm-plan-card">
                    <p className="hm-plan-card-error">Unable to load usage data.</p>
                  </div>
                )}

                <div className="hm-divider" />

                <p className="hm-label hm-label--tight">Buy top-up credits</p>
                <p className="hm-hint hm-hint--left">
                  Free 30 documents reset every month. Buy credits to keep going once it runs out —
                  credits never expire.
                </p>

                {packs.map(pack => (
                  <div key={pack.code} className="hm-pack-row">
                    <span className="hm-pack-credits">
                      {pack.credits.toLocaleString()} <span className="hm-pack-unit">credits</span>
                    </span>
                    <span className="hm-pack-price">฿{pack.price_thb.toLocaleString()}</span>
                    <button
                      type="button"
                      className={`hm-pack-btn${orderedPack === pack.code ? ' hm-pack-btn--done' : ''}`}
                      disabled={requesting !== null}
                      onClick={() => {
                        void handleRequest(pack)
                      }}
                    >
                      {orderedPack === pack.code ? (
                        <>
                          <Check size={12} /> Requested
                        </>
                      ) : requesting === pack.code ? (
                        'Requesting…'
                      ) : (
                        'Request'
                      )}
                    </button>
                  </div>
                ))}

                <p className="hm-hint">
                  Requesting a pack emails our team to confirm payment and credit your account.
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
