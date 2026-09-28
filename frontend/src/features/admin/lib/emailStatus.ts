/**
 * How #/admin/email reads an `email_documents` row and a poll result: reason and status
 * labels, tones, the toast for a poll, and "3 min ago". Pure — no React, no fetch.
 */

import type { EmailPollResult } from '@/features/admin/api/email'
import type { TKey } from '@/i18n/dict'

/** The ten the pipeline actually writes. CARMEN_INTEGRATION §3.3 lists three more
 *  (`out_of_credits`, `bank_not_identified`, `unbalanced_jv`) that it never emits —
 *  offering them as filters would promise rows that cannot exist. */
export const REASON_CODES = [
  'sender_not_allowed',
  'no_rule_match',
  'unreadable_document',
  'wrong_pdf_password',
  'tax_id_mismatch',
  'duplicate_document',
  'mapping_incomplete',
  'carmen_rejected',
  'carmen_unauthorized',
  'unsupported_attachment',
  'ingest_paused',
] as const

/** A code the pipeline writes maps to a label; anything else shows as itself, so a
 *  reason added to the backend without a translation is visible rather than blank. */
export function reasonKey(code: string): TKey | null {
  return (REASON_CODES as readonly string[]).includes(code)
    ? (`admin.email.reason.${code}` as TKey)
    : null
}

export const STATUSES = ['posted', 'failed', 'skipped', 'received'] as const

/**
 * `received` is neutral rather than "in progress": every write path leaves a terminal
 * status, so a row still sitting on `received` means the process died mid-document.
 * Worth seeing plainly, not dressed up as pending.
 */
export function statusTone(status: string): 'ok' | 'warn' | 'error' | 'neutral' {
  if (status === 'posted') return 'ok'
  if (status === 'failed') return 'error'
  if (status === 'skipped') return 'warn'
  return 'neutral'
}

/**
 * The four shapes a poll answers with, in the operator's words.
 *
 * `running` is not an error: the request waits 25s, the poll keeps going under
 * `asyncio.shield`, and the documents arrive in the table on the next refresh. Saying
 * "failed" there would send someone hunting a problem that does not exist.
 */
export function pollMessage(r: EmailPollResult): {
  tone: 'success' | 'info' | 'error'
  key: TKey
  vars?: Record<string, string | number>
} {
  if (r.status === 'disabled') return { tone: 'error', key: 'admin.email.toast.disabled' }
  if (r.status === 'busy') return { tone: 'info', key: 'admin.email.toast.busy' }
  if (r.status === 'running') return { tone: 'info', key: 'admin.email.toast.running' }
  if (r.confirmed !== undefined)
    return {
      tone: r.confirmed ? 'success' : 'info',
      key: 'admin.email.toast.confirmed',
      vars: { confirmed: r.confirmed, checked: r.checked ?? 0 },
    }
  const messages = r.messages ?? 0
  if (!messages) return { tone: 'info', key: 'admin.email.toast.noMail' }
  return {
    tone: 'success',
    key: 'admin.email.toast.polled',
    vars: {
      messages,
      posted: r.posted ?? 0,
      failed: r.failed ?? 0,
      skipped: r.skipped ?? 0,
      // Mail put back unread because the BU is switched off, out of package or has the
      // module disabled. It is the only outcome that leaves no row in the table below,
      // so the count here is the only place a growing backlog is visible at all.
      held: r.retry_later ?? 0,
    },
  }
}

/** Green while a schedule is active and fired within twice its own interval. */
export function cronTone(job: { active: boolean; last_status: string | null } | undefined) {
  if (!job || !job.active) return 'yellow' as const
  if (job.last_status && job.last_status !== 'succeeded') return 'red' as const
  return 'green' as const
}

/**
 * "3 min ago", not "2026-08-17 15:40:00".
 *
 * The tile answers one question — is this still running — and an absolute timestamp
 * makes the reader do the subtraction. It is also 19 characters of 1.6rem/800 type in
 * a 200px tile, which is how the card came to overflow in the first place. The exact
 * time stays one hover away in `title`.
 */
export function relativeAge(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return { key: 'admin.email.age.now' as TKey, vars: undefined }
  if (minutes < 60) return { key: 'admin.email.age.min' as TKey, vars: { n: minutes } }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'admin.email.age.hour' as TKey, vars: { n: hours } }
  return { key: 'admin.email.age.day' as TKey, vars: { n: Math.floor(hours / 24) } }
}
