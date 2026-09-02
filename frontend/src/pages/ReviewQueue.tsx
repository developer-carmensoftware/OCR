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
import { ACTIVITY_FILTERS, type ChipFilter } from '../lib/api/emailReview'
import { useRowsPerPage } from '../hooks/useRowsPerPage'
import { useT } from '../i18n/LanguageContext'
import { showToast } from '../lib/toast'
import type { TKey } from '../i18n/dict'

// `all` has no chip — it is still the API's default and still what `counts.all` answers,
// but the three below hold every row between them, so a fourth that repeats them is a
// choice with no consequence.
const FILTER_LABEL: Record<ChipFilter, TKey> = {
  review: 'review.filterReview',
  success: 'review.filterSuccess',
  unposted: 'review.filterUnposted',
}

// One column per header cell — the row component must stay in step with this list.
//
// **The class rides along, and it is not decoration.** `table-layout: fixed` reads column
// widths from the FIRST row only, which is this header row — so the widths in
// review-queue.css did nothing at all while `.rq-c-*` lived solely on the body `<td>`s and
// all six columns rendered at an equal 1/6. Document and Message were not narrow by design;
// they were starved by a class that was never on the cell the browser measures.
//
// Source is no longer a column: `MANUAL_FILTERS` means a manual scan only ever appears
// under Posted, so the column read "Email" on every row of the other two — the same
// argument §9 #19 used to delete it as a concept. On Posted, the Message column says which
// it was in words, which is why the icon that briefly replaced the column is gone too.
const COLUMNS: { key: TKey; cls: string }[] = [
  { key: 'review.colStatus', cls: 'rq-c-status' },
  { key: 'review.colDocument', cls: 'rq-c-doc' },
  { key: 'review.colMessage', cls: 'rq-c-msg' },
  { key: 'review.colReceived', cls: 'rq-c-when' },
  { key: 'review.colJv', cls: 'rq-c-jv' },
  { key: 'review.colActions', cls: 'rq-c-act' },
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
        <td key={c.key} className={c.cls}>
          <span className="rq-skel">&nbsp;</span>
        </td>
      ))}
    </tr>
  )
}

/** Shown once forwarding is live and there is nothing under the chip — which is where a
 *  working BU spends most of its time, so it has to read as success rather than as absence.
 *
 *  Its sentence must be true in both modes. "…land here for approval before they post" was
 *  written for review and describes, to a BU that has switched review off, the exact thing
 *  it stopped doing. Nothing on this page mentions `auto_post`; it lives behind the gear. */
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
    unseen,
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
  // Which empty chips get the tick. `review` empty means nothing is owed; `success` empty
  // is the first screen a BU sees after switching forwarding on, and "Nothing here yet."
  // is too thin a sentence for it. `unposted` empty gets the plain line — an empty pile of
  // failures is not an achievement, and a green tick over it would be celebrating a
  // non-event.
  const clearFilter = filter === 'review' || filter === 'success'
  // A BU with manual scans has rows even with forwarding off, so the sales pitch is gated
  // on having nothing at all rather than on the current filter being empty.
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

      {/* The chips are the heading. A line that read "3 waiting for you" said the number
          the Needs review chip prints two rows below it, and had nothing true to say to a
          BU that posts without review — so it is gone and the strip moved up into its row.

          Hidden until the BU has mail at all: three zeroes above an explanation of what the
          feature is would be scaffolding, not navigation. A BU with only manual scans still
          gets them — it has rows to filter. */}
      <div className="rq-bar">
        {(configured || !nothingEver) && (
          <div className="rq-tabs" role="tablist" aria-label={t('review.tabsLabel')}>
            {ACTIVITY_FILTERS.map(id => {
              // Whether this chip is holding something nobody here has looked at, and how
              // big the pile under it is. Three chips hold every row between them now, so
              // a cause with nothing pointing at it is a cause nobody finds — the shape of
              // the 2026-08-28 `sender_not_allowed` incident, whose whole family lives
              // under `unposted`.
              //
              // Two values because they answer different questions. Nothing retries a
              // failure, so a dot drawn from the count alone would be lit for good;
              // opening the chip is what puts it out, for the whole BU.
              const owed = attention[id] ?? 0
              const isNew = !!unseen[id]
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
                  {/* Never colour alone (WCAG 1.4.1) — the dot is decorative and the
                    sentence beside it is what a screen reader reads out. */}
                  {isNew && (
                    <>
                      <span className="rq-tab-dot" aria-hidden="true" />
                      <span className="sr-only">
                        {t('review.chipAttention', { count: String(owed) })}
                      </span>
                    </>
                  )}
                  {/* Only the work chip carries a number, and zero is shown on it — the
                    strip never reflows, because the other two never have one to lose.

                    `Needs review` is bounded by construction: backpressure hands mail back
                    unread past 50 pending, so it lives in 0–50 and goes down as it is
                    worked. `Posted` and `Not posted` are 0 to infinity and never go down —
                    at four figures the number is furniture, and it is on screen every day
                    for ever. The size of the list is in the Pager once the chip is open,
                    which is where it means something. */}
                  {id === 'review' && (
                    <span className="rq-tab-count text-mono">{counts[id] ?? 0}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
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
                    <th key={c.key} className={c.cls} scope="col">
                      {t(c.key)}
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

          {/* Three empty states, never one generic one. An empty Not posted list is not an
              achievement and must not borrow the tick. */}
          {!loading &&
            !hasWork &&
            (nothingEver && !configured ? (
              <NotSetUp
                address={status?.ingest_address ?? null}
                blockers={status?.blockers ?? []}
                entitled={!!status?.entitled}
              />
            ) : clearFilter && configured ? (
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
