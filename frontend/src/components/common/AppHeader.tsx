import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import logo from '../../assets/logo.png'
import { getCarmenUrl } from '../../lib/url'
import { useAuth } from '../../contexts/AuthContext'
import { useT } from '../../i18n/LanguageContext'
import NotificationBell from './NotificationBell'

interface Props {
  module?: string
  moduleName?: string
  eyebrow?: string
  backPath?: string
  onBack?: () => void
  backLabel?: string
  children?: ReactNode
}

/** Below this the action controls collapse into the `⋯` popover. Measured, not
 *  picked: the full row (back + logo + title + bell + credits + language +
 *  theme) needs ~559px of content width, which a 640px viewport just clears.
 *  Keep in sync with the same breakpoint in layout.css. */
const COMPACT_QUERY = '(max-width: 640px)'
const MENU_ID = 'app-header-menu'

export default function AppHeader({
  module,
  moduleName,
  eyebrow = 'Carmen Cloud · OCR Module',
  backPath,
  onBack,
  backLabel = 'Carmen',
  children,
}: Props) {
  const { isAuthenticated } = useAuth()
  const { t } = useT()

  // The menu is one DOM node that changes role at the breakpoint: an inline row
  // on desktop, a popover on phones. Rendering it twice instead would mount
  // UsageIndicator twice and fire its /usage fetch twice.
  // Optional call: jsdom has no matchMedia, and falling back to the full row is
  // the right default when we can't measure.
  const [compact, setCompact] = useState(() => !!window.matchMedia?.(COMPACT_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(COMPACT_QUERY)
    if (!mq) return
    const sync = () => setCompact(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const handleBack = () => {
    if (onBack) onBack()
    else if (backPath) window.location.href = getCarmenUrl(backPath)
    else window.location.hash = '#/'
  }

  return (
    <header className="app-header" data-module={module}>
      <button
        type="button"
        className="app-header-back"
        onClick={handleBack}
        aria-label={`Back to ${backLabel}`}
      >
        <ArrowLeft size={14} strokeWidth={2.25} />
        <span>{backLabel}</span>
      </button>
      <div className="app-header-sep" aria-hidden="true" />
      <div className="brand">
        <div className="logo-box">
          <img src={logo} alt="" className="logo-img" />
        </div>
        <div className="brand-text">
          <div className="app-header-eyebrow">{eyebrow}</div>
          <h1 className="app-header-title">{moduleName}</h1>
        </div>
      </div>
      <div className="app-header-actions">
        {/* The bell stays in the row at every width: it is the one control that
            carries state (unread count) rather than a preference. */}
        {isAuthenticated && <NotificationBell />}
        {children && (
          <>
            {compact && (
              <button
                type="button"
                className="app-header-more"
                aria-label={t('nav.moreActions')}
                // Native popover gives light-dismiss, Escape, and top-layer
                // painting for free — the last one matters because .app-header
                // sets backdrop-filter, which would otherwise make it the
                // containing block for a fixed panel and clip it to
                // overflow: hidden.
                popoverTarget={MENU_ID}
              >
                <MoreHorizontal size={18} strokeWidth={2} />
              </button>
            )}
            <div id={MENU_ID} className="app-header-menu" popover={compact ? 'auto' : undefined}>
              {children}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
