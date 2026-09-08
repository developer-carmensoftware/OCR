import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileX2,
  Mail,
  RefreshCw,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import UsageIndicator from '../components/common/UsageIndicator'
import Pager from '../components/common/Pager'
import QueueRow from '../components/credit-card/QueueRow'
import ReviewDocument from './ReviewDocument'
import { useReviewQueue } from '../hooks/credit-card/useReviewQueue'
import { prefetchGlMasters } from '../hooks/mapping/useGlMasters'
import { ACTIVITY_FILTERS, type ActivityFilter } from '../lib/api/emailReview'
import { useRowsPerPage } from '../hooks/useRowsPerPage'
import { useT } from '../i18n/LanguageContext'
import { showToast } from '../lib/toast'
import type { TKey } from '../i18n/dict'

// Five chips, and only three of them are about state. `today` cuts across those three on
// time; `all` selects on nothing and is the module's log — the one view that shows the
// attachments nobody was charged for, which `Posted` and `Not posted` no longer claim.
// Neither of the two carries a dot: a chip that is a view over the others does not get to
// shout on their behalf.
const FILTER_LABEL: Record<ActivityFilter, TKey> = {
  today: 'review.filterToday',
  review: 'review.filterReview',
  success: 'review.filterSuccess',
  unposted: 'review.filterUnposted',
  all: 'review.filterAll',
}

// What an empty chip says, per chip — because the same sentence cannot answer five different
// questions. One screen used to serve `review`, `success` and `today`, so an empty Posted
// chip read "All clear", which is not what an empty Posted chip means: nothing has posted.
//
// **The tick is earned, not decorative.** `review` and `today` are the two states that mean
// nothing is owed — everything else is an absence, and `DESIGN.md` bans celebrating a
// non-event. A semantic colour is a bare glyph, a neutral one sits in a muted well; that is
// the convention the rest of the app already follows.
//
// Every body has to be true with `auto_post` on **and** off, which is what broke the old
// copy: "…land here for approval" described, to a BU that had switched review off, the exact
// thing it had stopped doing. None of these names forwarding, so none of them can.
const EMPTY: Record<ActivityFilter, { Icon: LucideIcon; tone: string; title: TKey; body: TKey }> = {
  today: {
    Icon: CheckCircle2,
    tone: 'ok',
    title: 'review.emptyTodayTitle',
    body: 'review.emptyTodayBody',
  },
  review: {
    Icon: CheckCircle2,
    tone: 'ok',
    title: 'review.emptyReviewTitle',
    body: 'review.emptyReviewBody',
  },
  success: {
    Icon: FileCheck2,
    tone: 'calm',
    title: 'review.emptyPostedTitle',
    body: 'review.emptyPostedBody',
  },
  unposted: {
    Icon: FileX2,
    tone: 'calm',
    title: 'review.emptyUnpostedTitle',
    body: 'review.emptyUnpostedBody',
  },
  all: {
    Icon: Archive,
    tone: 'calm',
    title: 'review.emptyAllTitle',
    body: 'review.emptyAllBody',
  },
}

// One column per header cell — the row component must stay in step with this list.
//
// **The class rides along, and it is not decoration.** `table-layout: fixed` reads column
// widths from the FIRST row only, which is this header row — so the widths in
// review-queue.css did nothing at all while `.rq-c-*` lived solely on the body `<td>`s and
// all six columns rendered at an equal 1/6. Document and Detail were not narrow by design;
// they were starved by a class that was never on the cell the browser measures.
//
// Source is no longer a column: `MANUAL_FILTERS` means a manual scan only ever appears
// under Posted, so the column read "Email" on every row of the other two — the same
// argument §9 #19 used to delete it as a concept. On Posted, the Detail column says which
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

/** An empty chip, named for the chip it is empty on.
 *
 *  `DESIGN.md` requires an empty state to *teach the next step*, and the one this replaces
 *  taught none — it printed the ingest address mid-sentence and stopped. The address is gone
 *  from here entirely: `NotSetUp` gives it a proper mono field with a copy button, and a BU
 *  that is already receiving mail knows it. What earns the space instead is the one link
 *  that leads somewhere — the log — because since `all` became a chip a BU can be told
 *  "nothing here" while holding a hundred rows it cannot reach. */
function QueueEmpty({
  filter,
  hasHistory,
  onShowAll,
}: {
  filter: ActivityFilter
  hasHistory: boolean
  onShowAll: () => void
}) {
  const { t } = useT()
  const { Icon, tone, title, body } = EMPTY[filter]
  return (
    <div className="rq-empty">
      {/* The tone rides on a wrapper, not on the glyph: `--calm` draws a well around it and
          an SVG cannot draw its own. Colour still reaches the icon through currentColor. */}
      <span className={`rq-empty-icon rq-empty-icon--${tone}`} aria-hidden="true">
        <Icon size={tone === 'calm' ? 22 : 36} strokeWidth={tone === 'calm' ? 1.75 : 2} />
      </span>
      <h2 className="rq-empty-title">{t(title)}</h2>
      <p className="rq-empty-body">{t(body)}</p>
      {/* Not a second "Upload documents": that button is primary in the bar directly above,
          and repeating it here is the thing that reads as filler. This is the only route
          the page does not already offer. */}
      {filter !== 'all' && hasHistory && (
        <button type="button" className="btn btn-outline" onClick={onShowAll}>
          {t('review.viewAllActivity')}
        </button>
      )}
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
  // This one starts at 10 rather than the app-wide 15: the queue is a landing page, and a
  // reviewer should see the whole first page without scrolling. A stored choice still wins.
  const [limit, setLimit] = useRowsPerPage(10)
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
              // big the pile under it is. A cause with nothing pointing at it is a cause
              // nobody finds — the shape of the 2026-08-28 `sender_not_allowed` incident,
              // whose whole family is now in `review` until somebody puts it away.
              //
              // Two values because they answer different questions. Nothing retries a
              // failure, so a dot drawn from the count alone would be lit for good;
              // opening the chip is what puts it out, for the whole BU.
              //
              // `today` and `all` get no entry from the server and so never light. Every
              // row under them is counted under a status chip as well, so anything wrong
              // with one is already being pointed at.
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
                  {/* Only the two chips whose number can go down carry one, and zero is
                    shown on both — the strip never reflows, because the other three never
                    have one to lose.

                    `Review` is bounded by construction: backpressure hands mail back unread
                    past 50 pending, so it lives in 0–50 and falls as it is worked. `Today`
                    is bounded by the clock and empties itself every midnight. `Posted`,
                    `Not posted` and `All` are 0 to infinity and never fall — at four figures
                    the number is furniture, and it is on screen every day for ever. The size
                    of the list is in the Pager once the chip is open, which is where it
                    means something. */}
                  {(id === 'review' || id === 'today') && (
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
          {/* No auto-post switch here any more. It is one field of the BU's settings and
              has one writer, `PUT /api/v1/carmen/settings` — Carmen's own settings screen.
              Two writers for one boolean is what let an unrelated settings save turn review
              back on behind the customer's back (2026-09-08). */}
          <button type="button" className="btn btn-primary" onClick={goManual}>
            <Upload size={14} /> {t('review.uploadDocuments')}
          </button>
        </div>
      </div>

      {/* A failed fetch is never the empty state: "nothing is waiting" and "we could not
          ask" mean opposite things to someone deciding whether to go home. */}
      {error ? (
        <div className="rq-empty">
          <span className="rq-empty-icon rq-empty-icon--bad" aria-hidden="true">
            <AlertTriangle size={36} />
          </span>
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
                {rows.map(row => (
                  <QueueRow key={row.id} row={row} onOpen={openDoc} />
                ))}
              </tbody>
            </table>
          )}

          {/* Two screens, and the sales pitch is the special case. Everything else is one
              card whose words come from `EMPTY` — including the states that used to fall to
              a bare grey paragraph, which was the only thing on this page that looked
              unfinished. An empty Not posted still does not borrow the tick; that rule now
              lives in the map rather than in a condition here. */}
          {!loading &&
            !hasWork &&
            (nothingEver && !configured ? (
              <NotSetUp
                address={status?.ingest_address ?? null}
                blockers={status?.blockers ?? []}
                entitled={!!status?.entitled}
              />
            ) : (
              <QueueEmpty
                filter={filter}
                hasHistory={(counts.all ?? 0) > 0}
                onShowAll={() => setFilter('all')}
              />
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
