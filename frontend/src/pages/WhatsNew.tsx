import { useEffect, useState } from 'react'
import AppHeader from '../components/common/AppHeader'
import LanguageToggle from '../components/common/LanguageToggle'
import { useT } from '../i18n/LanguageContext'
import { RELEASE_NOTES } from '../content/releaseNotes'
import { markReleaseSeen, readReleaseSeen, WHATS_NEW_RETURN_KEY } from '../lib/releaseNotesSeen'
import { formatDate } from '../lib/date'
import '../styles/pages/whats-new.css'

/**
 * Release history. Entered from the notification bell, which carries the unread
 * badge; arriving here IS reading them, so the mark clears on mount.
 */
export default function WhatsNew() {
  const { t, lang } = useT()
  // Captured before the mark advances, so entries you have not read still wear
  // the "new" tag for the visit that clears them.
  const [seenOnArrival] = useState(readReleaseSeen)

  useEffect(() => {
    markReleaseSeen(RELEASE_NOTES[0]?.date ?? '')
  }, [])

  return (
    <div className="whatsnew-page">
      <AppHeader
        moduleName={t('whatsnew.title')}
        eyebrow="Carmen Cloud · AI Automation"
        backLabel={t('nav.back')}
        onBack={() => {
          window.location.hash = sessionStorage.getItem(WHATS_NEW_RETURN_KEY) || '#/'
        }}
      >
        <LanguageToggle />
      </AppHeader>

      <main className="whatsnew-main">
        <h1 className="whatsnew-title">{t('whatsnew.title')}</h1>
        <p className="whatsnew-subtitle">{t('whatsnew.subtitle')}</p>

        {RELEASE_NOTES.length === 0 ? (
          <p className="whatsnew-empty">{t('whatsnew.empty')}</p>
        ) : (
          <ol className="whatsnew-list">
            {RELEASE_NOTES.map(release => {
              const copy = release[lang]
              return (
                <li key={release.date} className="whatsnew-entry">
                  <div className="whatsnew-entry-meta">
                    <time className="whatsnew-date" dateTime={release.date}>
                      {formatDate(release.date)}
                    </time>
                    <span className="whatsnew-version">v{release.version}</span>
                    {release.date > seenOnArrival && (
                      <span className="whatsnew-tag">{t('whatsnew.new')}</span>
                    )}
                  </div>
                  <h2 className="whatsnew-entry-title">{copy.title}</h2>

                  {copy.features?.length ? (
                    <section className="whatsnew-cat">
                      <h3 className="whatsnew-cat-label whatsnew-cat-label--features">
                        {t('whatsnew.cat.features')}
                      </h3>
                      <ul className="whatsnew-items">
                        {copy.features.map(line => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {copy.fixes?.length ? (
                    <section className="whatsnew-cat">
                      <h3 className="whatsnew-cat-label whatsnew-cat-label--fixes">
                        {t('whatsnew.cat.fixes')}
                      </h3>
                      <ul className="whatsnew-items">
                        {copy.fixes.map(fix => (
                          <li key={fix.text}>
                            {fix.text}
                            <span className="whatsnew-before">
                              <span className="whatsnew-before-label">{t('whatsnew.before')}</span>
                              {fix.before}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {copy.qol?.length ? (
                    <section className="whatsnew-cat">
                      <h3 className="whatsnew-cat-label whatsnew-cat-label--qol">
                        {t('whatsnew.cat.qol')}
                      </h3>
                      <ul className="whatsnew-items">
                        {copy.qol.map(line => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </li>
              )
            })}
          </ol>
        )}
      </main>
    </div>
  )
}
