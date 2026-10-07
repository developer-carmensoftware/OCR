import CopyButton from '@/shared/components/ui/CopyButton'
import UrlText from '@/shared/components/apiKeys/UrlText'
import type { FeedStatus } from '@/shared/lib/apiKeys'
import { timeAgo } from '@/shared/lib/orderHelpers'
import { useT } from '@/i18n/LanguageContext'
import { fmtDateTime } from '@/shared/lib/date'

interface Props {
  /** null while loading; 'error' when the count could not be read. */
  status: FeedStatus | 'error' | null
  endpoint: string
  /** The next step when nothing is live. Omit to show the state without the pill. */
  onCreate?: () => void
}

/**
 * DESIGN.md §5 status line for Carmen's PMS feed: how many keys can call and when one last
 * did, then the endpoint to give Carmen. Amber, with a "Create key" pill, when no key is live.
 */
export default function StatusLine({ status, endpoint, onCreate }: Props) {
  const { t } = useT()
  const live = status && status !== 'error'
  const tone = !live ? 'idle' : status.active === 0 ? 'warn' : status.lastCall ? 'ok' : 'idle'

  return (
    <section className="apikeys-status" data-tone={tone} aria-label={t('apiKeys.status.aria')}>
      <div className="apikeys-status__main">
        <p className="apikeys-status__text" aria-live="polite">
          <span className="apikeys-status__dot" aria-hidden="true" />
          {status === null && t('apiKeys.status.loading')}
          {status === 'error' && t('apiKeys.status.unknown')}
          {live && status.active === 0 && (
            <>
              <strong>{t('apiKeys.status.none')}</strong>
              <span className="apikeys-status__meta">{t('apiKeys.status.noneMeta')}</span>
            </>
          )}
          {live && status.active > 0 && (
            <>
              <strong>
                {status.active === 1
                  ? t('apiKeys.status.keysOne')
                  : t('apiKeys.status.keysOther', { n: status.active })}
              </strong>
              <span className="apikeys-status__meta">
                {status.lastCall ? (
                  <time dateTime={status.lastCall} title={fmtDateTime(status.lastCall)}>
                    {t('apiKeys.status.lastCall', { ago: timeAgo(status.lastCall, t) })}
                  </time>
                ) : (
                  t('apiKeys.status.noCalls')
                )}
              </span>
            </>
          )}
        </p>
        {/* DESIGN.md §5: when the answer is no, the strip names the next step as a pill. */}
        {live && status.active === 0 && onCreate && (
          <button type="button" className="apikeys-step" onClick={onCreate}>
            {t('apiKeys.create')}
          </button>
        )}
      </div>
      <div className="apikeys-status__endpoint">
        <span className="apikeys-status__label">{t('apiKeys.status.endpoint')}</span>
        <span className="apikeys-method">POST</span>
        <UrlText url={endpoint} className="apikeys-url" />
        <CopyButton value={endpoint} ariaLabel={t('apiKeys.status.copyEndpoint')} />
      </div>
    </section>
  )
}
