import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { m } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { getUsage } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import { useAuth } from '../../contexts/AuthContext'
import { useT } from '../../i18n/LanguageContext'
import { catalogName } from '../../constants/billing'
import { formatDate } from '../../lib/date'
import type { UsageData } from '../../lib/api/auth'
import { computeUsageStats } from '../../lib/usage'

/** One label/value line in the popover. Values are mono per the Mono Signal Rule. */
function Row({
  label,
  value,
  note,
  total,
}: {
  label: string
  value: string
  note?: string
  total?: boolean
}) {
  return (
    <div className={`ui-quota-row${total ? ' is-total' : ''}`}>
      <span className="ui-quota-row-label">{label}</span>
      <span className="ui-quota-row-value">{value}</span>
      {note && <span className="ui-quota-row-note">{note}</span>}
    </div>
  )
}

export default function UsageIndicator() {
  const [usage, setUsage] = useState<UsageData['usage'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const { isAuthenticated } = useAuth() as { isAuthenticated: boolean }
  const { t } = useT()
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchUsage = async () => {
    try {
      const token = getStoredToken()
      if (token) {
        const data = await getUsage(token)
        setUsage(data.usage)
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void fetchUsage()
    window.addEventListener('ocr:quota-refresh', fetchUsage)
    return () => {
      window.removeEventListener('ocr:quota-refresh', fetchUsage)
    }
  }, [isAuthenticated])

  const stats = useMemo(() => computeUsageStats(usage), [usage])

  useEffect(() => {
    if (!btnRef.current || !stats) return
    btnRef.current.style.setProperty(
      '--used-pct-factor',
      `${Math.min(100, stats.usedPercentage) / 100}`
    )
    btnRef.current.style.setProperty('--quota-color', stats.color)
  }, [stats])

  // Anchor the portaled panel under the badge, right-aligned. Mirrors
  // NotificationBell — the CSS default keeps it top-right before this runs.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPanelStyle({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }, [open])

  // The panel is portaled to the end of <body>, so Tab from the trigger would
  // walk the rest of the header instead of entering it. Move focus in.
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  // Close on Escape / outside click / outside scroll / resize. Checks span both
  // trigger and panel because the panel is portaled to body.
  useEffect(() => {
    if (!open) return
    const isOutside = (target: Node) =>
      !btnRef.current?.contains(target) && !panelRef.current?.contains(target)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btnRef.current?.focus()
    }
    const onDown = (e: MouseEvent) => isOutside(e.target as Node) && setOpen(false)
    const onScroll = (e: Event) => isOutside(e.target as Node) && setOpen(false)
    const onResize = () => setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  // Nothing to show and nothing coming: the fetch effect bails out when not
  // authenticated, so `loading` would never clear and the skeleton would sit
  // there forever.
  if (!isAuthenticated) return null

  if (loading) {
    return (
      <div className="ui-quota ui-quota--skeleton" aria-hidden="true">
        <div className="ui-quota-col col-remain">
          {/* The label is static, so show it for real; only the number is unknown.
              Same geometry as the loaded trigger, so resolving usage doesn't
              reflow the header and re-truncate the module title. */}
          <span className="ui-quota-label">{t('quota.remain')}</span>
          <span className="ui-quota-value ui-quota-placeholder" />
        </div>
        <span className="ui-quota-chevron">
          <ChevronDown size={14} strokeWidth={2.25} />
        </span>
      </div>
    )
  }

  if (!stats) return null

  const sub = usage?.subscription

  return (
    <>
      <m.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t('quota.triggerAria', { remaining: stats.remaining_calls })}
          onClick={() => setOpen(o => !o)}
          className={`ui-quota ui-quota--trigger${stats.isLow ? ' is-low' : ''}`}
        >
          <div className="ui-quota-col col-remain">
            <span className="ui-quota-label">{t('quota.remain')}</span>
            <span className="ui-quota-value">{stats.remaining_calls}</span>
          </div>
          <span className="ui-quota-chevron" aria-hidden="true">
            {/* 14 / 2.25 matches ArrowLeft in .app-header-back, the icon sitting
                closest to it in the same header. */}
            <ChevronDown size={14} strokeWidth={2.25} />
          </span>
        </button>
      </m.div>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            tabIndex={-1}
            className={`ui-quota-panel${stats.isLow ? ' is-low' : ''}`}
            style={panelStyle}
            role="dialog"
            aria-label={t('quota.panelTitle')}
          >
            <header className="ui-quota-panel-header">{t('quota.panelTitle')}</header>

            <div className="ui-quota-rows">
              {/* One row per pool that actually exists — computeUsageStats sums all
                  three into REMAIN, which is why the badge alone can't explain itself. */}
              {stats.max_monthly_calls > 0 && (
                <Row
                  label={t('usage.freeLeft')}
                  // stats.remaining_calls is the SUM of all three pools; the raw
                  // usage field is the free-trial pool on its own.
                  value={`${usage?.remaining_calls ?? 0} / ${stats.max_monthly_calls}`}
                />
              )}
              {sub && (
                <Row
                  label={t('usage.planLeft')}
                  value={`${sub.docs_remaining} / ${sub.doc_allowance}`}
                  // formatDate(null) is "—", so only claim an expiry when there is
                  // one; same guard ActivePlanBanner uses in OrderHistory.
                  note={
                    catalogName(sub.plan_code) +
                    (sub.period_end
                      ? ` · ${t('usage.activeUntil')} ${formatDate(sub.period_end)}`
                      : '')
                  }
                />
              )}
              {stats.credit_balance > 0 && (
                <Row label={t('usage.topupCredits')} value={String(stats.credit_balance)} />
              )}
              <Row label={t('quota.total')} value={String(stats.remaining_calls)} total />
            </div>

            {stats.isLow && <p className="ui-quota-low-hint">{t('quota.lowHint')}</p>}

            <footer className="ui-quota-panel-footer">
              <a className="btn btn-primary" href="#/pricing" onClick={() => setOpen(false)}>
                {t('quota.topup')}
              </a>
              {/* nav.history ("History") is a tab label on the pricing page, where the
                  surrounding tabs give it context. A lone link needs to stand alone. */}
              <a
                className="ui-quota-history"
                href="#/pricing/orders"
                onClick={() => setOpen(false)}
              >
                {t('order.title')}
              </a>
            </footer>
          </div>,
          document.body
        )}
    </>
  )
}
