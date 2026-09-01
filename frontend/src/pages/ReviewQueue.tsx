import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Mail, RefreshCw, Upload } from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import UsageIndicator from '../components/common/UsageIndicator'
import Pager from '../components/common/Pager'
import QueueRow from '../components/credit-card/QueueRow'
import QueueSettings from '../components/credit-card/QueueSettings'
import ReviewDocument from './ReviewDocument'
import { useReviewQueue } from '../hooks/credit-card/useReviewQueue'
import { prefetchGlMasters } from '../hooks/mapping/useGlMasters'
import { ACTIVITY_FILTERS, type ActivityFilter } from '../lib/api/emailReview'
import { useRowsPerPage } from '../hooks/useRowsPerPage'
import { useT } from '../i18n/LanguageContext'
import { showToast } from '../lib/toast'
import type { TKey } from '../i18n/dict'

const FILTER_LABEL: Record<ActivityFilter, TKey> = {
  all: 'review.filterAll',
  review: 'review.filterReview',
  success: 'review.filterSuccess',
  failed: 'review.filterFailed',
  skipped: 'review.filterSkipped',
}

// One column per header cell — the row component must stay in step with this list, and the
// widths in review-queue.css are declared on these cells because `table-layout: fixed`
// reads only the first row.
//
// Source is no longer a column: `MANUAL_FILTERS` means a manual scan can only appear under
// two of the five chips, so it read "Email" on every row under the other three — the same
// argument §9 #19 used to delete it as a concept. It is an icon on the filename line now.
const COLUMNS: TKey[] = [
  'review.colStatus',
  'review.colDocument',
  'review.colMessage',
  'review.colReceived',
  'review.colJv',
  'review.colActions',
]

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
    <tr className="rq-row rq-row--skeleton" aria-hidden="true">
      {COLUMNS.map(c => (
        <td key={c}>
          <span className="rq-skel">&nbsp;</span>
        </td>
      ))}
    </tr>
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
  // Page size is the reader's, shared with every other table in the app. The options top
  // out at 100, which is the cap FastAPI enforces on GET /api/v1/credit-card/activity.
  const [limit, setLimit] = useRowsPerPage()
  const {
    status,
    filter,
    setFilter,
    rows,
    total,
    counts,
    attention,
    offset,
    setOffset,
    loading,
    error,
    reload,
  } = useReviewQueue(limit)
  const [reloading, setReloading] = useState(false)
  const [openId, setOpenId] = useState(docIdFromHash)

  // main.tsx renders this same component for both routes, so the hash change that opens a
  // document does not remount anything — this is what notices it.
  useEffect(() => {
    const onHash = () => setOpenId(docIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Carmen's chart of accounts is the slow half of opening a document, and it is the same
  // three lists whichever row is clicked. Fetched here, while the queue is being read, the
  // module-level cache is usually warm by the time the dialog mounts and the JV arrives
  // built. Only once there is something to open — a BU still setting forwarding up
  // downloads nothing.
  useEffect(() => {
    if (rows.length) void prefetchGlMasters()
  }, [rows.length])

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
  // The heading counts what needs a human, not what this filter happens to show — someone
  // reading the Skipped chip still wants to know whether anything is owed.
  const reviewCount = counts.review ?? 0
  // Empty under All or Needs review means "caught up". Empty under Success / Failed /
  // Skipped just means that bucket is empty, which is a different sentence.
  const workFilter = filter === 'all' || filter === 'review'
  // A BU with manual scans has a history even with forwarding off, so the sales pitch is
  // gated on having nothing at all rather than on the current filter being empty.
  const nothingEver = (counts.all ?? 0) === 0

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
          <button type="button" className="btn btn-primary" onClick={goManual}>
            <Upload size={14} /> {t('review.uploadDocuments')}
          </button>
        </div>
      </div>

      {/* Hidden until the BU has mail at all: a strip of five zeroes above an explanation
          of what the feature is would be scaffolding, not navigation. A BU with only
          manual scans still gets it — they have rows to filter. */}
      {(configured || !nothingEver) && (
        <div className="rq-tabs" role="tablist" aria-label={t('review.tabsLabel')}>
          {ACTIVITY_FILTERS.map(id => {
            // How many rows this chip holds that someone here could clear. The page opens
            // on Needs review, so Skipped — which is where every customer-fixable cause
            // lands, because `status` splits on billing rather than on who can act — is out
            // of sight by default. Without this the 2026-08-28 incident has its conditions
            // back: eight fixable rows, nothing pointing at them.
            const owed = attention[id] ?? 0
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={`rq-tab${filter === id ? ' rq-tab--active' : ''}`}
                onClick={() => setFilter(id)}
              >
                {t(FILTER_LABEL[id])}
                {/* Never colour alone (WCAG 1.4.1) — the dot is decorative and the sentence
                  beside it is what a screen reader reads out. */}
                {owed > 0 && (
                  <>
                    <span className="rq-tab-dot" aria-hidden="true" />
                    <span className="sr-only">
                      {t('review.chipAttention', { count: String(owed) })}
                    </span>
                  </>
                )}
                {/* Zero is shown too. A count that disappears makes the strip reflow as
                  documents resolve, and "0" is itself the answer to "anything failed?" */}
                <span className="rq-tab-count text-mono">{counts[id] ?? 0}</span>
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
          {(loading || hasWork) && (
            <table className="rq-table" aria-busy={loading || undefined}>
              <thead>
                <tr>
                  {COLUMNS.map(c => (
                    <th key={c} scope="col">
                      {t(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              {/* Skeletons only on the first load. A page turn keeps the rows it has and
                  dims them — swapping them for skeletons and back makes every arrow click
                  flash, in a table that is about to show almost the same thing. */}
              <tbody>
                {loading &&
                  !hasWork &&
                  Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
                {hasWork && rows.map(row => <QueueRow key={row.id} row={row} onOpen={openDoc} />)}
              </tbody>
            </table>
          )}

          {/* Three empty states, never one generic one. An empty Success list means
              nothing has posted yet, which is not the same claim as "you are all caught
              up" and must not borrow its tick. */}
          {!loading &&
            !hasWork &&
            (nothingEver && !configured ? (
              <NotSetUp
                address={status?.ingest_address ?? null}
                blockers={status?.blockers ?? []}
                entitled={!!status?.entitled}
              />
            ) : workFilter && configured ? (
              <AllClear address={status?.ingest_address ?? null} />
            ) : (
              <p className="rq-empty-tab">{t('review.emptyTab')}</p>
            ))}

          {hasWork && (
            <Pager
              offset={offset}
              limit={limit}
              total={total}
              onChange={setOffset}
              // Back to page 1: offset 380 at a new limit of 100 points past the end.
              onLimitChange={n => {
                setLimit(n)
                setOffset(0)
              }}
            />
          )}
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
