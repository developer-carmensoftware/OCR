import { useState } from 'react'
import ReactDOM from 'react-dom'
import { Wallet, X, ExternalLink } from 'lucide-react'
import { getUsage } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import '../../styles/components/header-modals.css'
import type { UsageData } from '../../lib/api/auth'

const SUPPORT_EMAIL = 'support@carmen-cloud.com'

export default function PaymentButton() {
  const [open, setOpen] = useState(false)
  const [usage, setUsage] = useState<UsageData['usage'] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const token = getStoredToken()
      if (token) {
        const data = await getUsage(token)
        setUsage(data.usage)
      }
    } catch {
      /* non-critical — modal still opens */
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setUsage(null)
  }

  const usedPct =
    usage && usage.max_monthly_calls > 0
      ? Math.min(100, (usage.monthly_calls / usage.max_monthly_calls) * 100)
      : 0

  const isLow = usage ? usage.remaining_calls <= 5 || usedPct >= 90 : false
  const barColor = usedPct >= 90 ? 'var(--rose)' : usedPct >= 70 ? 'var(--amber)' : 'var(--teal)'

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=Quota%20Upgrade%20Request&body=Hi%2C%20I%20would%20like%20to%20upgrade%20my%20OCR%20quota.`

  return (
    <>
      <button
        type="button"
        className="btn-icon"
        title="Manage plan"
        onClick={() => {
          void handleOpen()
        }}
      >
        <Wallet size={15} strokeWidth={2} />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div className="hm-overlay" role="dialog" aria-modal="true" aria-label="Manage Plan">
            <div className="hm-backdrop" onClick={handleClose} />
            <div className="hm-dialog">
              <div className="hm-header">
                <Wallet size={15} className="hm-header-icon" strokeWidth={2} />
                <span className="hm-header-title">Manage Plan</span>
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
                      <span className="hm-plan-row-label">Used this month</span>
                      <span className="hm-plan-row-value">{usage.monthly_calls}</span>
                    </div>
                    <div className="hm-plan-row">
                      <span className="hm-plan-row-label">Remaining</span>
                      <span
                        className={`hm-plan-row-value${isLow ? ' hm-plan-row-value--low' : ''}`}
                      >
                        {usage.remaining_calls}
                      </span>
                    </div>
                    <div className="hm-plan-row">
                      <span className="hm-plan-row-label">Monthly limit</span>
                      <span className="hm-plan-row-value">{usage.max_monthly_calls}</span>
                    </div>
                    <div className="hm-progress-bar">
                      <div
                        className="hm-progress-fill"
                        ref={el => {
                          if (el) {
                            el.style.width = `${usedPct}%`
                            el.style.background = barColor
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hm-plan-card">
                    <p className="hm-plan-card-error">Unable to load usage data.</p>
                  </div>
                )}

                <div className="hm-divider" />

                <p className="hm-hint">
                  Need more quota or want to upgrade your plan?
                  <br />
                  Contact our team and we'll get you set up.
                </p>

                <a href={mailtoHref} className="hm-btn-submit" onClick={handleClose}>
                  <ExternalLink size={13} />
                  Contact to Upgrade
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
