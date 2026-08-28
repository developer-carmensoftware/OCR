import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Mail, RefreshCw, ScanLine } from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import UsageIndicator from '../components/common/UsageIndicator'
import Pager from '../components/common/Pager'
import QueueRow from '../components/credit-card/QueueRow'
import QueueSettings from '../components/credit-card/QueueSettings'
import ReviewDocument from './ReviewDocument'
import { useReviewQueue } from '../hooks/credit-card/useReviewQueue'
import { QUEUE_TABS, type QueueTab } from '../lib/api/emailReview'
import { useFitRows } from '../hooks/useFitRows'
import { useT } from '../i18n/LanguageContext'
import { showToast } from '../lib/toast'
import type { TKey } from '../i18n/dict'

// Mirrors the cap FastAPI enforces on GET /api/v1/email/documents (422 above it).
const MAX_PAGE = 100

const TAB_LABEL: Record<QueueTab, TKey> = {
  review: 'review.tabReview',
  posted: 'review.tabPosted',
  problem: 'review.tabProblem',
  skipped: 'review.tabSkipped',
}

const QUEUE = '#/CreditCardOCR'

function goManual() {
  window.location.hash = '#/CreditCardOCR/manual'
}

/** The document the URL says is open, if any. A route rather than local state so a
 *  document can be linked to, and so Back closes it. */
function docIdFromHash(): string | null {
  const [route, query] = window.location.hash.split('?')
  if (!route.toLowerCase().includes('/review')) return null
  return query ? new URLSearchParams(query).get('id') : null
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
  const { status, tab, setTab, rows, total, offset, setOffset, loading, error, reload } =
    useReviewQueue(limit)
  const [reloading, setReloading] = useState(false)
  const [openId, setOpenId] = useState(docIdFromHash)

  // main.tsx renders this same component for both routes, so the hash change that opens a
  // document does not remount anything — this is what notices it.
  useEffect(() => {
    const onHash = () => setOpenId(docIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const refresh = () => {
    setReloading(true)
    reload()
    window.setTimeout(() => setReloading(false), 600)
  }

  const openDoc = (id: string) => {
    window.location.hash = `${QUEUE}/review?id=${id}`
  }

  const configured = !!status?.enabled && !!status?.entitled
  const hasWork = rows.length > 0
  // The heading counts what needs a human, not what this tab happens to show — someone
  // reading the Skipped tab still wants to know whether anything is owed.
  const reviewCount = status?.counts?.review ?? 0

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
              : reviewCount
                ? t('review.waitingHeading', { count: String(reviewCount) })
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
          {/* Nothing to configure until mail is actually arriving. */}
          {configured && <QueueSettings autoPost={!!status?.auto_post} onChanged={reload} />}
          {/* Outline, not primary. On this page the main action is approving what the
              robot already did; scanning by hand is the secondary path. */}
          <button type="button" className="btn btn-outline" onClick={goManual}>
            <ScanLine size={14} /> {t('review.manualScan')}
          </button>
        </div>
      </div>

      {/* Hidden until the BU has mail at all: a strip of four zeroes above an
          explanation of what the feature is would be scaffolding, not navigation. */}
      {configured && (
        <div className="rq-tabs" role="tablist" aria-label={t('review.tabsLabel')}>
          {QUEUE_TABS.map(id => {
            const n = status?.counts?.[id] ?? 0
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`rq-tab${tab === id ? ' rq-tab--active' : ''}`}
                onClick={() => setTab(id)}
              >
                {t(TAB_LABEL[id])}
                {/* Zero is shown too. A count that disappears makes the strip reflow as
                    documents resolve, and "0" is itself the answer to "anything failed?" */}
                <span className="rq-tab-count text-mono">{n}</span>
              </button>
            )
          })}
        </div>
      )}

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

          {!loading && !hasWork && configured && tab === 'review' && (
            <AllClear address={status?.ingest_address ?? null} />
          )}
          {/* An empty Posted tab means nothing has posted yet, which is not the same
              claim as "you are all caught up" and must not borrow its tick. */}
          {!loading && !hasWork && configured && tab !== 'review' && (
            <p className="rq-empty-tab">{t('review.emptyTab')}</p>
          )}
          {!loading && !hasWork && !configured && tab === 'review' && (
            <NotSetUp
              address={status?.ingest_address ?? null}
              blockers={status?.blockers ?? []}
              entitled={!!status?.entitled}
            />
          )}

          {hasWork && <Pager offset={offset} limit={limit} total={total} onChange={setOffset} />}
        </>
      )}

      {openId && (
        <ReviewDocument
          id={openId}
          onClose={() => {
            window.location.hash = QUEUE
          }}
          onDone={() => {
            window.location.hash = QUEUE
            reload()
          }}
        />
      )}
    </div>
  )
}
