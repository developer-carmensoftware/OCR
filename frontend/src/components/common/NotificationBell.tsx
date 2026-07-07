import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import '../../styles/components/notification-bell.css'
import { useNotifications } from '../../hooks/notifications'
import type { Notification } from '../../lib/api/notifications'

const TYPE_TONE: Record<string, string> = {
  approved: 'success',
  rejected: 'error',
  on_hold: 'warning',
  missing_slip: 'warning',
}

function notifText(n: Notification, t: (key: any, vars?: any) => string): string {
  const p = n.payload as Record<string, unknown>
  switch (n.type) {
    case 'approved':
      return t('notif.approved', { credits: p.credits ?? '?' })
    case 'rejected':
      return t('notif.rejected', { reason: p.reason ?? '' })
    case 'on_hold':
      return t('notif.onHold')
    case 'missing_slip':
      return t('notif.missingSlip')
    default:
      return n.type
  }
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell() {
  const { t } = useT()
  const { items, unreadCount, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Anchor the portaled panel under the bell, right-aligned to its edge.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPanelStyle({
      position: 'fixed',
      top: r.bottom + 8,
      right: window.innerWidth - r.right,
    })
  }, [open])

  // Close on outside click / Escape / scroll / resize. The panel lives in a
  // portal on document.body, so the check must span BOTH the trigger and the
  // panel — else clicks inside the panel would count as "outside".
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const close = () => setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [open])

  const handleItem = async (n: Notification) => {
    if (!n.read_at) await markRead([n.id])
    setOpen(false)
    window.location.hash = '#/pricing/orders'
  }

  const handleMarkAll = async () => {
    await markRead()
  }

  return (
    <div className="notif-bell">
      <button
        ref={btnRef}
        type="button"
        className="notif-bell__trigger"
        aria-label={t('notif.bellAria')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="notif-bell__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="notif-bell__panel"
            style={panelStyle}
            role="dialog"
            aria-label={t('notif.title')}
          >
            <div className="notif-bell__header">
              <span className="notif-bell__title">{t('notif.title')}</span>
              {unreadCount > 0 && (
                <button type="button" className="notif-bell__mark-all" onClick={handleMarkAll}>
                  <CheckCheck size={14} />
                  {t('notif.markAllRead')}
                </button>
              )}
            </div>

            <ul className="notif-bell__list">
              {items.length === 0 && <li className="notif-bell__empty">{t('notif.empty')}</li>}
              {items.map(n => (
                <li
                  key={n.id}
                  className={`notif-bell__item notif-bell__item--${TYPE_TONE[n.type] ?? 'info'}${!n.read_at ? ' notif-bell__item--unread' : ''}`}
                  onClick={() => handleItem(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleItem(n)
                  }}
                >
                  <span className="notif-bell__text">{notifText(n, t)}</span>
                  <span className="notif-bell__time">{timeAgo(n.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}
