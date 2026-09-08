import { getCarmenUrl } from './url'
import type { TKey } from '../i18n/dict'

/**
 * Why the pipeline stopped, and where a person goes to unstop it.
 *
 * Its own module because two screens read it now: the queue row, which prints the phrase in
 * its Detail column, and the review dialog, which prints the same phrase in a banner above
 * the fields — a reviewer opening a parked document has to be told what stopped it before
 * being asked to fix it. `stopText` below is what keeps them one sentence rather than two.
 */

/** The reason codes the pipeline actually writes **and this app can show**. Anything unmapped
 *  falls back to the raw code rather than to a blank — an unfamiliar code is still a lead.
 *
 *  `no_rule_match` is absent on purpose, not by oversight: the activity endpoint's
 *  `_visible()` keeps those rows out of every view, so a phrase for it here would be a string
 *  nothing can print. The admin screen shows them and has its own key
 *  (`admin.email.reason.no_rule_match`). */
export const REASON_KEY: Record<string, TKey> = {
  sender_not_allowed: 'review.rcSenderNotAllowed',
  unsupported_attachment: 'review.rcUnsupported',
  unreadable_document: 'review.rcUnreadable',
  wrong_pdf_password: 'review.rcWrongPassword',
  tax_id_mismatch: 'review.rcTaxIdMismatch',
  duplicate_document: 'review.rcDuplicate',
  mapping_incomplete: 'review.rcMappingIncomplete',
  carmen_rejected: 'review.rcCarmenRejected',
  // Distinct from carmen_rejected on purpose: a dead credential and a bad JV are fixed by
  // different people on different screens, and a dead one fails EVERY document of the BU.
  carmen_unauthorized: 'review.rcCarmenUnauthorized',
  ingest_paused: 'review.rcIngestPaused',
  rejected_by_reviewer: 'review.rcRejectedByReviewer',
}

/**
 * Codes whose `error_message` **is** the message — printed in place of the phrase above,
 * not appended to it.
 *
 * Two, and only where the phrase cannot tell two rows apart. Eight `carmen_rejected` rows
 * said the same three words while Carmen's own verdict — the whole support ticket, per
 * `_carmen_verdict` — sat in a hover title nobody hovers. `duplicate_document` covers both
 * "Already posted to Carmen" and "A copy is already waiting for review", which are different
 * answers to "so what do I do". Both details are written server-side to stand alone as the
 * whole cell, which is also why they are capitalised there and not here.
 *
 * The cost is that these two lines are English for a Thai reader, which is why the set is
 * this small: everything else keeps its translated phrase. Carmen's verdict and a
 * reviewer's typed reason were never translatable anyway — they are another system's words
 * and a colleague's.
 *
 * `tax_id_mismatch` is deliberately not here. The phrase already says the whole finding and
 * the number adds nothing a reviewer acts on; it stays on the title for support.
 */
export const WITH_DETAIL = new Set(['carmen_rejected', 'duplicate_document'])

/**
 * The one sentence a stopped row says about itself — the queue's cell, and the banner the
 * review dialog opens with.
 *
 * One function, because the two must not drift: a reviewer opening a row is checking the
 * sentence they just read, and a banner that paraphrased it would read as a second,
 * different finding. It was a local helper in QueueRow while only the row used it, and the
 * dialog's own copy is exactly what drifted — it printed `phrase · detail` for every code,
 * which for the two in `WITH_DETAIL` gave every banner a vacuous head ("Already handled ·
 * Already posted to Carmen") and said "Carmen" twice.
 *
 * `full` is the one thing the two surfaces genuinely differ on. A cell keeps the detail on
 * its hover title because it has no width for it; the dialog has the width, and a reviewer
 * deciding whether a tax ID is theirs needs the number rather than the finding. It never
 * repeats what the phrase was already replaced by.
 */
export function stopText(
  row: { reason_code?: string | null; error_message?: string | null },
  t: (k: TKey) => string,
  full = false
): string {
  const code = row.reason_code ?? ''
  const detail = row.error_message?.trim()
  if (detail && WITH_DETAIL.has(code)) return detail
  const key = code ? REASON_KEY[code] : undefined
  const phrase = key ? t(key) : code || t('review.rcUnknown')
  return full && detail ? `${phrase} · ${detail}` : phrase
}

/** One extraction finding, as the normalizers now emit it: a code plus the numbers it
 *  needs. See `ExtractionWarning` in `models/schemas/ocr.py`. */
export interface ExtractionWarning {
  code: string
  params?: Record<string, string>
}

/**
 * The sentence for one extraction finding, in the reader's language.
 *
 * The backend used to compose this prose itself, which pinned every warning banner to
 * English on two screens that are otherwise bilingual — a process handling a cron-driven
 * mailbox cannot know who will open the queue. It names the finding now and this writes it.
 *
 * **A string still renders.** `review_payload` holds the extraction of every document
 * already waiting in a queue, so documents parked before the shape changed carry prose, and
 * they arrive here as `legacy` with the text in `params.text`. An unknown code prints its
 * own name rather than nothing, the same call `stopText` makes: an unfamiliar code is still
 * a lead, a blank banner is not.
 */
export function warningText(
  warning: ExtractionWarning | string,
  t: (k: TKey, vars?: Record<string, string | number>) => string
): string {
  if (typeof warning === 'string') return warning
  const params = { ...(warning.params || {}) }
  if (warning.code === 'legacy') return params.text || ''
  // Include/Exclude is our own word for whether VAT sits inside the unit price, not a field
  // name Carmen owns, so it reads translated rather than raw inside a Thai sentence.
  if (params.taxType) {
    const key = `warn.taxType.${params.taxType}` as TKey
    const translated = t(key)
    if (translated !== key) params.taxType = translated
  }
  const key = `warn.${warning.code}` as TKey
  const text = t(key, params)
  return text === key ? warning.code : text
}

/** Carmen's own settings screen, as a path rather than a URL: `getCarmenUrl` reads the
 *  session's Carmen origin, which is not set when this module is imported. `fixLinkProps`
 *  resolves it at render. */
const SETTINGS = { key: 'review.actionOpenSettings' as TKey, href: '/setting' }

/**
 * Where a person fixes each cause — and nothing at all for the ones they cannot.
 *
 * **Keyed on `reason_code`, not on `status`.** The skipped/failed split is about whether a
 * credit was charged (`status = "skipped" if charged is None else "failed"` in
 * `email_ingest_service.py`), which says nothing about whether anyone can act:
 * `sender_not_allowed` is `skipped` and is one field away from fixed, while
 * `carmen_rejected` is `failed` and there is nothing to press here. Filing the actionable
 * ones under the chip the design doc calls "mostly noise" is how eight `sender_not_allowed`
 * rows cost a day of diagnosis on 2026-08-28.
 *
 * Deliberately absent, because a button would be a lie: `carmen_rejected` (Carmen's own
 * complaint, fixed in Carmen), `duplicate_document` (already posted, nothing owed),
 * `unreadable_document` / `unsupported_attachment` (we cannot re-read a file we never
 * stored — the Upload button above is the whole answer), `rejected_by_reviewer` (terminal
 * by design).
 *
 * **Most of these now appear on `pending_review` rows**, since a refusal that came after a
 * paid-for extraction parks rather than finishing. On the row itself Review still wins —
 * opening the document is the stronger action, and it is where the reviewer reads the
 * reason. This map is what the dialog's banner offers beside it.
 *
 * **A settings cause goes to Carmen, not to us.** Every field these buttons are about — the
 * bank rule, the PDF password, the tax IDs, the switch, the posting token — is written by
 * Carmen's settings screen (§0, §2.7). Our `#/email-settings` is the copy we keep so the
 * contract can be exercised end to end; it is a support surface, and pointing a customer at
 * it sent them to edit a value on the screen that does not own it. `mapping_incomplete` is
 * the one cause that is genuinely ours — the GL mapping stays in this app.
 */
export const FIX: Record<string, { key: TKey; href: string }> = {
  mapping_incomplete: { key: 'review.actionFixMapping', href: '#/CreditCardOCR/mapping' },
  // Its own word, not the generic one: this is not "a setting is off", it is "the pipeline
  // is down for this BU until someone re-pastes the token".
  carmen_unauthorized: { key: 'review.actionReconnect', href: '/setting' },
  sender_not_allowed: SETTINGS,
  wrong_pdf_password: SETTINGS,
  ingest_paused: SETTINGS,
  tax_id_mismatch: SETTINGS,
}

/**
 * The `<a>` props for a fix button — one function, because the row and the dialog must open
 * the same door the same way.
 *
 * An in-app hash navigates in this tab. Carmen's screen is another application: it gets a tab
 * of its own, exactly like the Open JV link beside it, so a reviewer fixing a setting still
 * has the queue behind them. The `#` test is the whole rule — an internal link always starts
 * with one and a resolved Carmen URL never does.
 */
export function fixLinkProps(fix: { href: string }): {
  href: string
  target?: string
  rel?: string
} {
  if (fix.href.startsWith('#')) return { href: fix.href }
  return { href: getCarmenUrl(fix.href), target: '_blank', rel: 'noopener noreferrer' }
}
