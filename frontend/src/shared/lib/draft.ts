/**
 * Unsent wizard drafts — the thing that survives a session drop.
 *
 * A pilot user gets kicked to the login screen mid-wizard roughly every 30 minutes:
 * our OCR JWT and Carmen's token are two independent fixed-length clocks and neither
 * refreshes. We cannot prevent that (Carmen exposes no refresh), so the goal is to make
 * it survivable — the scan and every correction on it are kept, and re-opening the
 * module from Carmen offers to put them back.
 *
 * Why localStorage and not sessionStorage: re-entry from the Carmen menu may land in a
 * NEW tab, where sessionStorage is already gone. That choice costs a shared-device
 * residue window, bounded by TTL_MS and by tenant namespacing (a different tenant can
 * never read it) and softened by never restoring without asking.
 *
 * Why the key is NOT in `APP_STORAGE_BASES`: `clearAppStorage()` is what the
 * `ocr:unauthorized` handler calls — putting drafts in that list would delete them on
 * exactly the event they exist to recover from. Same carve-out `ocr_carmen_uri:`
 * documents in ./storage.ts. Logout and tenant switch call `clearAllDrafts()` instead.
 */

import { appKey } from './storage'

export type DraftKind = 'cc' | 'ap'

const PREFIX = 'ocr_draft:'

// ponytail: a flat 6h expiry, not per-tenant policy. Ceiling: on a shared PC a colleague
// on the SAME tenant can see the restore prompt for up to this long. Shorten it, or move
// drafts server-side keyed by carmen_user_id, if that ever turns into a real complaint.
const TTL_MS = 6 * 60 * 60 * 1000

/**
 * **Bump this in the same commit as ANY change to a wizard's snapshot shape.**
 *
 * A draft outlives a deploy by up to TTL_MS, so without a version gate a snapshot written
 * by the old build gets restored into the new one — a renamed or dropped field lands as
 * `undefined` in state and throws on the next render. The restore prompt is the trigger
 * and nothing clears the draft on a crash, so the user would hit the same broken page on
 * every entry until the TTL ran out. Cheaper than validating every field.
 */
const DRAFT_VERSION = 1

interface Envelope<T> {
  v: number
  at: number
  data: T
}

function keyFor(kind: DraftKind): string {
  return appKey(`${PREFIX}${kind}`)
}

/** Persist a wizard snapshot. Never throws — a full quota must not break a scan. */
export function saveDraft<T>(kind: DraftKind, data: T): void {
  try {
    const envelope: Envelope<T> = { v: DRAFT_VERSION, at: Date.now(), data }
    localStorage.setItem(keyFor(kind), JSON.stringify(envelope))
  } catch {
    /* quota exceeded / storage unavailable — the draft is a bonus, not a guarantee */
  }
}

/**
 * Read a saved snapshot, or null if there is none, it is unreadable, it was written by a
 * different app version, or it has aged out. Anything rejected is removed on the way out
 * so it can never be offered again.
 */
export function loadDraft<T>(kind: DraftKind): { at: number; data: T } | null {
  try {
    const raw = localStorage.getItem(keyFor(kind))
    if (!raw) return null
    const envelope = JSON.parse(raw) as Partial<Envelope<T>>
    if (typeof envelope?.at !== 'number' || envelope.data === undefined) {
      clearDraft(kind)
      return null
    }
    if (envelope.v !== DRAFT_VERSION) {
      clearDraft(kind)
      return null
    }
    if (Date.now() - envelope.at > TTL_MS) {
      clearDraft(kind)
      return null
    }
    return { at: envelope.at, data: envelope.data as T }
  } catch {
    clearDraft(kind)
    return null
  }
}

/** Drop one wizard's draft — submitted, discarded, or started over. */
export function clearDraft(kind: DraftKind): void {
  try {
    localStorage.removeItem(keyFor(kind))
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * Body copy for the restore prompt, shared by both wizards.
 *
 * The "image is not kept" line is not boilerplate: the File cannot be serialized, so a
 * restored document shows an empty preview pane. Saying so up front is the difference
 * between a known limitation and a bug report.
 */
export function draftPromptMessage(label: string | undefined, at: number): string {
  const when = new Date(at).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const what = label ? `“${label}”` : 'A document'
  return (
    `${what} from ${when} was never submitted.\n\n` +
    'Restore it to carry on where you left off, or discard it and start over.\n' +
    'The scanned image itself is not kept, so the preview will be empty.'
  )
}

/**
 * Drop every tenant's drafts. For logout and tenant switch only — NOT for session
 * expiry, which is the case drafts exist for.
 */
export function clearAllDrafts(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('t:') && k.includes(`:${PREFIX}`)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
