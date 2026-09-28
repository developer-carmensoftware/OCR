/** Email ingestion: the document ledger, health, business units, and manual poll/sweep. */

import { buildQs, unwrapDetail, type QueryParams } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'

/** One (message, attachment) the ingest pipeline reached a verdict on. */
export interface EmailDocumentRow {
  id: string
  created_at: string | null
  tenant_id: string
  tenant_name: string | null
  message_id: string
  attachment: string
  /** received | posted | failed | skipped — `failed` means a credit was charged. */
  status: string
  /** null on `posted`; one of the eight pipeline reasons otherwise. */
  reason_code: string | null
  bank_code: string | null
  doc_no: string | null
  jv_no: string | null
  error_message: string | null
  /** Our MX's dmarc/dkim/spf verdict, e.g. "dmarc=pass dkim=pass spf=softfail". Measurement only. */
  auth_verdict: string | null
  task_id: string | null
  /** null when the row never reached `consume_document` — i.e. nothing was spent. */
  charged_docs: number | null
  original_filename: string | null
}

export interface EmailJobRun {
  status: string | null
  started_at: string | null
  rows_affected: number | null
  error_message: string | null
}

export interface EmailCronJob {
  schedule: string
  active: boolean
  last_run: string | null
  last_status: string | null
}

export interface EmailIngestHealth {
  /** null when pg_cron is unreadable — the page reads that as "not scheduled". */
  cron: Record<string, EmailCronJob> | null
  last_runs: Record<string, EmailJobRun | null>
  documents_24h: Record<string, number>
  awaiting_confirmation: number
  mailbox: {
    configured: boolean
    folder: string | null
    address: string | null
    batch_size: number
  }
}

export interface EmailBusinessUnitRow {
  tenant_id: string
  tenant_name: string
  host: string
  bu_code: string
  enabled: boolean
  ingest_tag: string | null
  ingest_address: string | null
  rules: number
  active_rules: number
  tax_ids: number
  owner_emails: number
  blockers: string[]
  gmail_confirmed_at: string | null
  token: { configured: boolean; fingerprint: string | null; verified_at: string | null }
  documents_total: number
  last_received_at: string | null
  updated_at: string | null
}

/** Either a poll summary, or one of the three states the pipeline reports instead. */
export interface EmailPollResult {
  status?: 'busy' | 'disabled' | 'running'
  reason?: string
  messages?: number
  posted?: number
  failed?: number
  skipped?: number
  unrouted?: number
  retry_later?: number
  /** Unseen mail already older than IMAP_HOLD_DAYS — no poll will ever see it again. */
  beyond_window?: number
  checked?: number
  confirmed?: number
  waiting?: number
}

export async function fetchEmailDocuments(
  params: QueryParams = {}
): Promise<{ total: number; counts: Record<string, number>; data: EmailDocumentRow[] }> {
  const res = await adminFetch(`${API.admin.emailDocuments}${buildQs(params)}`)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch email documents'))
  return res.json()
}

export async function fetchEmailHealth(): Promise<EmailIngestHealth> {
  const res = await adminFetch(API.admin.emailHealth)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch email health'))
  return res.json()
}

export async function fetchEmailBusinessUnits(): Promise<{
  total: number
  data: EmailBusinessUnitRow[]
}> {
  const res = await adminFetch(API.admin.emailBusinessUnits)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch business units'))
  return res.json()
}

/** Runs one mailbox poll. Spends a document per matched attachment. */
export async function pollEmailNow(): Promise<EmailPollResult> {
  const res = await adminFetch(API.admin.emailPoll, { method: 'POST' })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to start the poll'))
  return res.json()
}

/** Follows any waiting Gmail forwarding-confirmation link. Costs nothing. */
export async function sweepEmailConfirmations(): Promise<EmailPollResult> {
  const res = await adminFetch(API.admin.emailConfirmations, { method: 'POST' })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to check confirmations'))
  return res.json()
}
