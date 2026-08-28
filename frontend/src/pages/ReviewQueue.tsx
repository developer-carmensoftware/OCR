import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Mail, RefreshCw, ScanLine } from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import UsageIndicator from '../components/common/UsageIndicator'
import Pager from '../components/common/Pager'
import QueueRow from '../components/credit-card/QueueRow'
import { useReviewQueue } from '../hooks/credit-card/useReviewQueue'
import { useFitRows } from '../hooks/useFitRows'
import { useT } from '../i18n/LanguageContext'
import { showToast } from '../lib/toast'

// Mirrors the cap FastAPI enforces on GET /api/v1/email/documents (422 above it).
const MAX_PAGE = 100

function goManual() {
  window.location.hash = '#/CreditCardOCR/manual'
}

/** The skeleton is the real row with its content hidden, so the list does not jolt when
 *  data lands. A guessed height is what made OrderHistory jump; same lesson, same fix. */
function RowSkeleton() {
  return (
    <li className="rq-row rq-row--skeleton" aria-hidden="true">
      <span className="rq-row-btn">
        <span className="rq-row-main">
          <span className="rq-bank">&nbsp;</span>
        </span>
        <span className="rq-row-sub">&nbsp;</span>
      </span>
    </li>
  )
}

/** Shown once forwarding is live and the queue is clear — which is where a working BU
 *  spends most of its time, so it has to read as success rather than as absence. */
function AllClear({ address }: { address: string | null }) {
  const { t } = useT()
  return (
    <div className="rq-empty">
      <CheckCircle2 size={40} className="rq-empty-icon rq-empty-icon--ok" aria-hidden="true" />
      <h2 className="rq-empty-title">{t('review.allClearTitle')}</h2>
      <p className="rq-empty-body">
        {address ? t('review.allClearBody', { address }) : t('review.allClearBodyNoAddress')}
      </p>
    </div>
  )
}

/**
 * Every BU that has not switched forwarding on lands here, which today is nearly all of
 * them. It is the only place the automation can be discovered, so it is the one screen on
 * this page allowed to make a case for itself.
 */
function NotSetUp({
  address,
  blockers,
  entitled,
}: {
  address: string | null
  blockers: string[]
  entitled: boolean
}) {
  const { t } = useT()
  const disabled = blockers.includes('disabled')

  const copy = () => {
    if (!address) return
    void navigator.clipboard
      .writeText(address)
      .then(() => showToast(t('review.addressCopied'), 'success'))
      .catch(() => showToast(t('review.addressCopyFailed'), 'error'))
  }

  return (
    <div className="rq-intro">
      <Mail size={36} className="rq-intro-icon" aria-hidden="true" />
      <h2 className="rq-intro-title">{t('review.introTitle')}</h2>
      <p className="rq-intro-body">{t('review.introBody')}</p>

      {/* An address that cannot receive mail is worse than no address, so an unentitled
          BU is told about the package instead of being handed one. */}
      {entitled && address ? (
        <>
          <div className="rq-address">
            <code className="text-mono">{address}</code>
            <button
              type="button"
              className="btn-icon"
              onClick={copy}
              aria-label={t('review.copyAddress')}
              title={t('review.copyAddress')}
            >
              <Copy size={14} />
            </button>
          </div>
          {disabled && <p className="rq-intro-note">{t('review.introSwitchedOff')}</p>}
        </>
      ) : (
        <p className="rq-intro-note">{t('review.introNotEntitled')}</p>
      )}

      <ol className="rq-steps">
        <li>{t('review.step1')}</li>
        <li>{t('review.step2')}</li>
        <li>{t('review.step3')}</li>
      </ol>

      <a className="btn btn-outline" href="#/email-settings">
        {t('review.openSettings')}
      </a>
    </div>
  )
}

export default function ReviewQueue() {
  const { t } = useT()
  // Page size = whatever fits above the fold, measured off the fixed-height part of a row.
  const [fits, listRef] = useFitRows('.rq-row-main', 5)
  const limit = Math.min(fits, MAX_PAGE)
  const { status, rows, total, offset, setOffset, loading, error, reload } = useReviewQueue(limit)
  const [reloading, setReloading] = useState(false)

  const refresh = () => {
    setReloading(true)
    reload()
    window.setTimeout(() => setReloading(false), 600)
  }

  const openDoc = (id: string) => {
    window.location.hash = `#/CreditCardOCR/review?id=${id}`
  }

  const configured = !!status?.enabled && !!status?.entitled
  const hasWork = rows.length > 0

  return (
    <div className="app-container">
      <AppHeader
        module="credit-card"
        moduleName={t('review.title')}
        eyebrow="Carmen Cloud · Credit Card"
        backPath="/glJv"
      >
        <UsageIndicator />
      </AppHeader>

      <div className="rq-bar">
        <div className="rq-bar-left">
          <h1 className="rq-heading">
            {loading
              ? t('review.loadingHeading')
              : hasWork
                ? t('review.waitingHeading', { count: String(total) })
                : t('review.nothingWaiting')}
          </h1>
          {status?.auto_post && <span className="rq-autopost">{t('review.autoPostOn')}</span>}
        </div>
        <div className="rq-bar-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={refresh}
            disabled={loading}
            aria-label={t('review.refresh')}
            title={t('review.refresh')}
          >
            <RefreshCw size={14} className={reloading || loading ? 'animate-spin' : ''} />
          </button>
          {/* Outline, not primary. On this page the main action is approving what the
              robot already did; scanning by hand is the secondary path. */}
          <button type="button" className="btn btn-outline" onClick={goManual}>
            <ScanLine size={14} /> {t('review.manualScan')}
          </button>
        </div>
      </div>

      {/* A failed fetch is never the empty state: "nothing is waiting" and "we could not
          ask" mean opposite things to someone deciding whether to go home. */}
      {error ? (
        <div className="rq-empty">
          <AlertTriangle
            size={36}
            className="rq-empty-icon rq-empty-icon--bad"
            aria-hidden="true"
          />
          <h2 className="rq-empty-title">{t('review.errorTitle')}</h2>
          <p className="rq-empty-body">{t('review.errorBody')}</p>
          <button type="button" className="btn btn-outline" onClick={refresh}>
            {t('review.retry')}
          </button>
        </div>
      ) : (
        <>
          <ul className="rq-list" ref={listRef}>
            {loading && Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
            {!loading && rows.map(row => <QueueRow key={row.id} row={row} onOpen={openDoc} />)}
          </ul>

          {!loading && !hasWork && configured && (
            <AllClear address={status?.ingest_address ?? null} />
          )}
          {!loading && !hasWork && !configured && (
            <NotSetUp
              address={status?.ingest_address ?? null}
              blockers={status?.blockers ?? []}
              entitled={!!status?.entitled}
            />
          )}

          {hasWork && <Pager offset={offset} limit={limit} total={total} onChange={setOffset} />}
        </>
      )}
    </div>
  )
}
