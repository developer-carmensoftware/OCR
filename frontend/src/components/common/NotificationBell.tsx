import { useEffect, useRef, useState } from 'react'
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
  const ref = useRef<HTMLDivElement>(null)

  // close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
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
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className="notif-bell__trigger"
        aria-label={t('notif.bellAria')}
        onClick={() => setOpen(o => !o)}
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="notif-bell__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-bell__panel" role="dialog" aria-label={t('notif.title')}>
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
        </div>
      )}
    </div>
  )
}
