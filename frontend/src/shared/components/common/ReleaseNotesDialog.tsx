import { useEffect, useState } from 'react'
import Dialog from '@/shared/components/ui/Dialog'
import { useT } from '@/i18n/LanguageContext'
import { RELEASE_NOTES } from '@/shared/content/releaseNotes'
import { markReleaseSeen, readReleaseSeen } from '@/shared/lib/releaseNotesSeen'
import { formatDate } from '@/shared/lib/date'
import '@/styles/components/release-notes.css'

const SECTIONS = [
  ['keyFeatures', 'whatsnew.cat.keyFeatures'],
  ['features', 'whatsnew.cat.features'],
  ['enhancements', 'whatsnew.cat.enhancements'],
] as const

interface Props {
  onClose: () => void
  /** The row that opened it is gone with the bell panel, so focus needs somewhere else to go. */
  returnFocus?: () => HTMLElement | null
}

/**
 * The release history, one entry per monthly release, laid out like Carmen's own changelog.
 * Opened from the bell, which carries the unread badge; opening it IS reading them, so the
 * mark clears on mount.
 */
export default function ReleaseNotesDialog({ onClose, returnFocus }: Props) {
  const { t, lang } = useT()
  // Captured before the mark advances, so entries you have not read still wear the
  // "new" tag for the visit that clears them.
  const [seenOnArrival] = useState(readReleaseSeen)

  useEffect(() => {
    markReleaseSeen(RELEASE_NOTES[0]?.date ?? '')
  }, [])

  return (
    <Dialog
      title={t('whatsnew.title')}
      onDismiss={onClose}
      closable
      closeLabel={t('whatsnew.close')}
      returnFocus={returnFocus}
    >
      {RELEASE_NOTES.length === 0 ? (
        <p className="relnotes-empty">{t('whatsnew.empty')}</p>
      ) : (
        <ol className="relnotes-list">
          {RELEASE_NOTES.map(release => {
            const copy = release[lang]
            return (
              <li key={release.date} className="relnotes-entry">
                <div className="relnotes-meta">
                  <span className="relnotes-version">{release.version}</span>
                  <time className="relnotes-date" dateTime={release.date}>
                    {t('whatsnew.releaseDate', { date: formatDate(release.date) })}
                  </time>
                  {release.date > seenOnArrival && (
                    <span className="relnotes-tag">{t('whatsnew.new')}</span>
                  )}
                </div>
                {SECTIONS.map(([key, label]) => {
                  const lines = copy[key]
                  if (!lines?.length) return null
                  return (
                    <section key={key} className="relnotes-cat">
                      <h3 className="relnotes-cat-label">{t(label)}</h3>
                      <ul className="relnotes-items">
                        {lines.map(line => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </li>
            )
          })}
        </ol>
      )}
    </Dialog>
  )
}
