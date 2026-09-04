import { useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
// The admin dashboard's switch, because it is the app's only one and its CSS is already
// global (index.css imports admin.css). A second switch would be a second look.
import Switch from '../admin/ui/Switch'
import { useT } from '../../i18n/LanguageContext'
import { showToast } from '../../lib/toast'
import { setAutoPost } from '../../lib/api/emailReview'

/**
 * The auto-post switch, behind a gear rather than on the queue itself.
 *
 * It is a decision a BU makes once, after weeks of watching the queue get it right. Putting
 * that switch next to the documents would offer it every day to someone whose actual job on
 * this screen is approving one.
 *
 * What it turns off is approving the *ordinary* document. It cannot turn off approving a
 * doubtful one: the pipeline posts unattended only when the reading has nothing flagged —
 * the same test that paints this queue's reason column — so a warning, a guessed GL mapping,
 * amounts that do not reconcile or a missing document number still land here either way.
 */
export default function QueueSettings({
  autoPost,
  onChanged,
}: {
  autoPost: boolean
  onChanged: () => void
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const flip = async (on: boolean) => {
    setBusy(true)
    try {
      await setAutoPost(on)
      showToast(on ? t('review.autoPostSavedOn') : t('review.autoPostSavedOff'), 'success')
      // The badge in the bar reads the same status this page fetched, so re-read it
      // rather than keeping a second copy of the answer here.
      onChanged()
    } catch {
      showToast(t('review.autoPostFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rq-settings" ref={wrap}>
      <button
        type="button"
        className="btn-icon"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('review.settings')}
        title={t('review.settings')}
        onClick={() => setOpen(o => !o)}
      >
        <Settings size={14} />
      </button>

      {open && (
        <div className="rq-settings-panel" role="dialog" aria-label={t('review.settings')}>
          <Switch
            checked={autoPost}
            disabled={busy}
            onChange={flip}
            label={t('review.autoPostLabel')}
          />
          {/* Specific on purpose: this is the one control on the page that lets a document
              reach Carmen unseen, so it names what still stops rather than reassuring. */}
          <p className="rq-settings-hint">{t('review.autoPostHint')}</p>
          <a className="rq-settings-link" href="#/email-settings">
            {t('review.openSettings')}
          </a>
        </div>
      )}
    </div>
  )
}
