import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileCheck2,
  FileX2,
  RefreshCw,
  ScanLine,
  SearchX,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import AppHeader from '@/shared/components/common/AppHeader'
import UsageIndicator from '@/shared/components/common/UsageIndicator'
import Pager from '@/shared/components/common/Pager'
import { FilterBar } from '@/features/credit-card/components/QueueFilters'
import QueueRow from '@/features/credit-card/components/QueueRow'
import ReviewDocument from './ReviewDocument'
import PmsReviewDocument from './PmsReviewDocument'
import { useReviewQueue } from '@/features/credit-card/hooks/useReviewQueue'
import { prefetchGlMasters } from '@/features/credit-card/hooks/mapping/useGlMasters'
import {
  ALL_SCOPES,
  narrowCount,
  NO_NARROW,
  reconcileNarrow,
  QUEUE_CHIPS,
  type ActivityFilter,
  type QueueNarrow,
  type QueueRange,
  type QueueSource,
} from '@/features/credit-card/api/emailReview'
import { useRowsPerPage } from '@/shared/hooks/useRowsPerPage'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'

// Two chips (§24): the work, and the log. Today, Posted and Not posted were chips of their
// own until the page was told to point at what somebody here has to do and nothing else. They
// are now rows of the Filters popover — Status (Posted / Not posted) and Date (Today) — and
// Posted / Not posted light the All chip, which is where the log lives.
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
// Source is not a column: the Detail column says which it was in words ("scanned by …",
// "posted automatically"), which is why the icon that briefly replaced the column is gone
// too (§9 #19).
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
function docIdFromHash(param: 'id' | 'pms' = 'id'): string | null {
  const [route, query] = window.location.hash.split('?')
  if (!route.toLowerCase().includes('/review')) return null
  return query ? new URLSearchParams(query).get(param) : null
}

/** The PMS day the URL says is open (`?pms=`): a day is not a document, and opens its own
 *  dialog (CA-119). */
const pmsIdFromHash = () => docIdFromHash('pms')

/** The filter the URL asked to open on, if any — how the bell's blocked/failed rows land
 *  on All filtered to `unposted` instead of wherever `useReviewQueue`'s own fall-through
 *  would pick. Read once at mount, same as `docIdFromHash`; the page does not track it
 *  afterwards, so switching chips by hand does not fight this. */
function filterFromHash(): ActivityFilter | null {
  const query = window.location.hash.split('?')[1]
  const f = query ? new URLSearchParams(query).get('filter') : null
  return ([...QUEUE_CHIPS, ...ALL_SCOPES] as string[]).includes(f || '')
    ? (f as ActivityFilter)
    : null
}

const SOURCE_IDS: readonly string[] = ['email', 'manual', 'pms']
const RANGE_IDS: readonly string[] = ['today', '7d', '30d']

/** The narrowing the URL asked to open on (`q`, `source`, `bank`, `range`) — a view pasted
 *  from a colleague. Read once at mount, like `filterFromHash`; `syncUrl` below is what
 *  writes it back. Unknown words are dropped rather than trusted. */
function narrowFromHash(): QueueNarrow {
  const query = window.location.hash.split('?')[1]
  if (!query) return NO_NARROW
  const p = new URLSearchParams(query)
  const range = p.get('range') || ''
  // `reconcileNarrow`: `?source=pms&bank=SCB` is a contradiction the API would refuse (400), so a
  // pasted link repairs itself here — before the first request, not after a failed one.
  return reconcileNarrow({
    q: (p.get('q') || '').slice(0, 100),
    sources: (p.get('source') || '')
      .split(',')
      .filter(x => SOURCE_IDS.includes(x)) as QueueSource[],
    bank: (p.get('bank') || '').toUpperCase().slice(0, 20),
    range: (RANGE_IDS.includes(range) ? range : '') as QueueRange,
  })
}

/** The view, as the queue's own hash — so it survives a reload and can be pasted. Only the
 *  queue route: while a document is open the hash belongs to the document. `replaceState`
 *  rather than assigning the hash, so Back is not spent on every chip. */
function syncUrl(filter: ActivityFilter, narrow: QueueNarrow, defaultFilter: ActivityFilter) {
  const p = new URLSearchParams()
  // The default is only the default for an un-narrowed page: a URL that carries a narrowing
  // and no `filter` opens on All (`useReviewQueue`), so Review + a narrowing must say so, or
  // a reload would land on a different tab than the one that was pasted.
  if (filter !== defaultFilter || narrowCount(narrow) > 0) p.set('filter', filter)
  if (narrow.q) p.set('q', narrow.q)
  if (narrow.sources.length) p.set('source', narrow.sources.join(','))
  if (narrow.bank) p.set('bank', narrow.bank)
  if (narrow.range) p.set('range', narrow.range)
  const qs = p.toString()
  const next = qs ? `${QUEUE}?${qs}` : QUEUE
  if (window.location.hash !== next) window.history.replaceState(null, '', next)
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
 *  from here entirely; a BU that is receiving mail already knows it. What earns the space
 *  instead is the one link
 *  that leads somewhere — the log — because since `all` became a chip a BU can be told
 *  "nothing here" while holding a hundred rows it cannot reach. */
function QueueEmpty({ filter, onShowAll }: { filter: ActivityFilter; onShowAll: () => void }) {
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
          the page does not already offer. Always something to see: a BU with no rows at all
          gets `NoScansYet` instead of this card. */}
      {filter !== 'all' && (
        <button type="button" className="btn btn-outline" onClick={onShowAll}>
          {t('review.viewAllActivity')}
        </button>
      )}
    </div>
  )
}

/**
 * A BU that has never scanned anything. The page is this module's activity log — email is
 * one way in, not the point — so the only next step is the first scan, and the bar's
 * primary Upload button directly above already offers it. A second one here was the same
 * button twice on an otherwise empty page, so this card is a sentence, like `QueueEmpty`.
 *
 * There used to be a full-page pitch for email forwarding here (`NotSetUp`). Most BUs scan
 * by hand and always will, and an ad on the landing page told them they were using the
 * product wrong. Carmen's menu introduces the automation, opening our settings screen.
 */
function NoScansYet() {
  const { t } = useT()
  return (
    <div className="rq-empty">
      <span className="rq-empty-icon rq-empty-icon--calm" aria-hidden="true">
        <ScanLine size={22} strokeWidth={1.75} />
      </span>
      <h2 className="rq-empty-title">{t('review.noScansTitle')}</h2>
      <p className="rq-empty-body">{t('review.noScansBody')}</p>
    </div>
  )
}

/** The narrowing matched nothing. Not `QueueEmpty`: that card's words are about a status
 *  ("Nothing needs review") and would be false here, and its one link, "view all activity",
 *  would leave the filters on. The way out is removing them. */
function NoMatch({ onClear }: { onClear: () => void }) {
  const { t } = useT()
  return (
    <div className="rq-empty">
      <span className="rq-empty-icon rq-empty-icon--calm" aria-hidden="true">
        <SearchX size={22} strokeWidth={1.75} />
      </span>
      <h2 className="rq-empty-title">{t('review.noMatchTitle')}</h2>
      <p className="rq-empty-body">{t('review.noMatchBody')}</p>
      <button type="button" className="btn btn-outline" onClick={onClear}>
        {t('review.clearAll')}
      </button>
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
  // `today` is a date range now, so an old link to it lands on All + Today.
  const [initial] = useState(() => {
    const f = filterFromHash()
    const n = narrowFromHash()
    return f === 'today'
      ? { filter: 'all' as const, narrow: { ...n, range: 'today' as const } }
      : { filter: f, narrow: n }
  })
  const {
    filter,
    setFilter,
    narrow,
    setNarrow,
    rows,
    total,
    counts,
    offset,
    setOffset,
    loading,
    error,
    reload,
  } = useReviewQueue(limit, initial.filter, initial.narrow)
  const [reloading, setReloading] = useState(false)
  const [openId, setOpenId] = useState(() => docIdFromHash())
  const [openPms, setOpenPms] = useState(pmsIdFromHash)

  // main.tsx renders this same component for both routes, so the hash change that opens a
  // document does not remount anything — this is what notices it.
  useEffect(() => {
    const onHash = () => {
      setOpenId(docIdFromHash())
      setOpenPms(pmsIdFromHash())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Same non-remount problem as above, for a bell link fired while already sitting on
  // this page: `filterFromHash()` passed to `useReviewQueue` above only catches a fresh
  // mount. A hash with no `filter` (opening a document, or any other in-page navigation)
  // leaves the chip alone — only a link that actually names one moves it.
  useEffect(() => {
    const onHash = () => {
      const f = filterFromHash()
      if (!f) return
      // Same translation as at mount.
      if (f === 'today') {
        setFilter('all')
        setNarrow({ ...narrowFromHash(), range: 'today' })
      } else {
        setFilter(f)
        setNarrow(narrowFromHash())
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [setFilter, setNarrow])

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

  const openDoc = (id: string, source?: string) => {
    window.location.hash = `${QUEUE}/review?${source === 'pms' ? 'pms' : 'id'}=${id}`
  }

  const hasWork = rows.length > 0
  const narrowed = narrowCount(narrow) > 0
  // Nothing at all, from any source — not merely an empty chip. Counts are taken under the
  // narrowing, so a search that matches nothing must not read as a BU that never scanned.
  const nothingEver = !narrowed && (counts.all ?? 0) === 0
  // Every filter that is not the work is a view of the log, so it lights the All chip.
  const chip = filter === 'review' ? 'review' : 'all'

  // The URL follows the view, but never while a document is open: then the hash is that
  // document's, and closing it re-runs this with both ids cleared and restores the view.
  useEffect(() => {
    if (openId || openPms) return
    const [route] = window.location.hash.split('?')
    if (route.toLowerCase() !== QUEUE.toLowerCase()) return
    syncUrl(filter, narrow, counts.review === undefined || counts.review > 0 ? 'review' : 'all')
  }, [filter, narrow, openId, openPms, counts.review])

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

          Hidden until the BU has a single row, from either source: chips above "no scans
          yet" would be scaffolding, not navigation.

          No dot on either chip (§24). It used to point at anomalies nobody had looked at;
          the Review count already says there is work, and the bell rings for what it rings
          for. What neither covers — a sender the BU never allowed, a paused rule — is under
          Filters → Status → Not posted, by decision. There is no Posted or Not posted chip
          either, by decision: the page is for what somebody here has to do. */}
      <div className="rq-bar">
        {!nothingEver && (
          <div className="rq-tabs" role="tablist" aria-label={t('review.tabsLabel')}>
            {QUEUE_CHIPS.map(id => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={chip === id}
                className={`rq-tab${chip === id ? ' rq-tab--active' : ''}`}
                onClick={() => setFilter(id)}
              >
                {t(FILTER_LABEL[id])}
                {/* Only Review carries a number, and zero is shown — the strip never
                    reflows. It is bounded by construction (backpressure hands mail back
                    unread past 50 pending) and falls as it is worked. `All` is 0 to
                    infinity and never falls: at four figures the number is furniture. Its
                    size is in the Pager, which is where it means something. */}
                {id === 'review' && (
                  <span className="rq-tab-count text-mono">{counts.review ?? 0}</span>
                )}
              </button>
            ))}
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
          <button
            type="button"
            className="btn-icon"
            onClick={() => window.open('#/CreditCardOCR/mapping', '_blank')}
            aria-label={t('cc.mappingSettings')}
            title={t('cc.mappingSettings')}
          >
            <Settings size={14} />
          </button>
          {/* No auto-post switch here any more. It is one field of the BU's settings and
              has one writer, `PUT /api/v1/carmen/settings`, behind one screen,
              `#/CreditCardOCR/email-settings`. Two writers for one boolean is what let an unrelated
              settings save turn review back on behind the customer's back (2026-09-08).
              No settings link either: Carmen's menu is the front door (decision #34).

              No AR-settings door here either. Every value on that screen is scoped to one
              bank profile, and this bar has no document in scope to take it from — it
              opened on a hardcoded KBANK, which is configuration built on a guess. The
              door lives in the review modal, where the document's own `bank_code` is in
              hand (2026-09-16). */}
          <button type="button" className="btn btn-primary" onClick={goManual}>
            <Upload size={14} /> {t('review.uploadDocuments')}
          </button>
        </div>
      </div>

      {/* Which documents, beside the strip's what-became-of-them. A row of its own: the
          strip plus three buttons already fill the bar at tablet width. Hidden with the
          strip while the BU has no rows at all. */}
      {!nothingEver && (
        <FilterBar narrow={narrow} onChange={setNarrow} status={filter} onStatus={setFilter} />
      )}

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
                  <QueueRow key={row.id} row={row} onOpen={openDoc} onChanged={reload} />
                ))}
              </tbody>
            </table>
          )}

          {/* Two screens, and a BU with no scans at all is the special case. Everything else
              is one card whose words come from `EMPTY`. An empty Not posted still does not
              borrow the tick; that rule lives in the map rather than in a condition here. */}
          {!loading &&
            !hasWork &&
            (nothingEver ? (
              <NoScansYet />
            ) : narrowed ? (
              <NoMatch onClear={() => setNarrow(NO_NARROW)} />
            ) : (
              <QueueEmpty filter={filter} onShowAll={() => setFilter('all')} />
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

      {openPms && (
        <PmsReviewDocument
          id={openPms}
          onClose={() => {
            window.location.hash = QUEUE
          }}
          onDone={() => {
            window.location.hash = QUEUE
            reload()
          }}
        />
      )}

      {openId && (
        <ReviewDocument
          id={openId}
          bankHint={rows.find(r => r.id === openId)?.bank_code}
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
