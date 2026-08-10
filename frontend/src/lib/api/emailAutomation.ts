/**
 * Email Automation settings — the API Carmen calls, called the way Carmen calls it.
 *
 * Deliberately NOT `apiFetch`, for two reasons that both matter:
 *
 *   1. Auth. These endpoints take the user's **raw Carmen token** in `Authorization`
 *      with no scheme label (`email_automation.py::_caller` strips an optional
 *      `CarmenToken ` prefix and treats anything that is not `Bearer ` as a Carmen
 *      token). `apiFetch` would send `Bearer <our session JWT>`, which takes the
 *      admin-operator branch and skips the Carmen probe entirely — i.e. it would test
 *      none of what this screen exists to test.
 *
 *   2. 401. `apiFetch` treats a 401 as "our session died" and fires `ocr:unauthorized`,
 *      which wipes tenant storage and drops the user on the reconnect screen. A 401
 *      here means *Carmen* rejected the token — a different failure with a different
 *      remedy, and one the contract (CARMEN_INTEGRATION.md §2.1) explicitly asks to be
 *      rendered apart from a 502 "cannot reach Carmen".
 */
import { getCarmenRawToken, resolveUrl } from './client'
import { API } from './endpoints'

export interface EmailRule {
  bank_code: string | null
  bank_sender_email: string | null
  filename_patterns: string[]
  /** Read side only — the password itself is never returned. */
  has_password?: boolean
  is_active: boolean
}

/** What we PUT. `pdf_password` is write-only: omitted (null) keeps the stored one,
 *  `''` clears it, a value sets it (`email_settings_service._merge_rule`). */
export interface EmailRulePayload extends Omit<EmailRule, 'has_password'> {
  pdf_password?: string | null
}

export interface EmailSettings {
  host: string
  bu: string
  enabled: boolean
  /** null until the BU successfully enables the feature and a tag is issued. */
  ingest_address: string | null
  /** The BU's own addresses. Empty = accept any sender; non-empty = a message must
   *  carry one of them in From/To/Cc. A second layer over the tag, never the router. */
  owner_emails: string[]
  tax_ids: string[]
  rules: EmailRule[]
  /** When the poll followed Gmail's confirmation link and Google accepted it — the
   *  forward is live. This is normally the only signal there is: Google stopped
   *  printing a confirmation code, so `gmail_confirm` below is usually null. */
  gmail_confirmed_at: string | null
  gmail_confirm: { code: string; at: string | null } | null
  status: {
    ready: boolean
    blockers: string[]
    documents_total?: number
    last_received_at?: string | null
  }
  entitled?: boolean
}

export interface SettingsPayload {
  host: string
  bu: string
  enabled: boolean
  owner_emails: string[]
  tax_ids: string[]
  rules: EmailRulePayload[]
}

export interface TokenStatus {
  configured: boolean
  fingerprint: string | null
  carmen_uri: string | null
  verified_at: string | null
}

export interface BankCode {
  code: string
  name: string
}

/** A failed call, with the field errors already unpacked so the caller can render
 *  them next to the input that caused them rather than as one opaque banner. */
export class EmailApiError extends Error {
  status: number
  /** `errors[]` keyed by `field` — e.g. `tax_ids[0]`, `rules[1].filename_patterns`. */
  fieldErrors: Record<string, string>
  codes: Record<string, string>

  constructor(status: number, detail: string, errors: ApiFieldError[] = []) {
    super(detail)
    this.name = 'EmailApiError'
    this.status = status
    this.fieldErrors = Object.fromEntries(errors.map(e => [e.field, e.message]))
    this.codes = Object.fromEntries(errors.map(e => [e.field, e.code]))
  }
}

interface ApiFieldError {
  field: string
  code: string
  message: string
}

async function call<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getCarmenRawToken()
  if (!token) {
    throw new EmailApiError(401, 'No Carmen token — reopen this page from Carmen.')
  }
  const headers = new Headers(options.headers || {})
  // No scheme prefix: `Authorization: <token>`, the same shape every other call in
  // Carmen's world uses.
  headers.set('Authorization', token)

  const res = await fetch(resolveUrl(url), { ...options, headers })
  if (res.ok) {
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }

  const body = (await res.json().catch(() => ({}))) as {
    detail?: string
    errors?: ApiFieldError[]
  }
  throw new EmailApiError(res.status, body.detail || `Request failed (${res.status})`, body.errors)
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const getBankCodes = () =>
  call<{ banks: BankCode[] }>(API.emailAutomation.bankCodes).then(r => r.banks)

export const getSettings = (host: string, bu: string) =>
  call<EmailSettings>(API.emailAutomation.settingsFor(host, bu))

/** Full replace, not a delta — `save_settings` rewrites tax IDs and rules wholesale,
 *  so every caller sends the complete current state. The response is the same body
 *  GET returns, which is why nothing here needs a follow-up read. */
export const saveSettings = (payload: SettingsPayload) =>
  call<EmailSettings>(API.emailAutomation.settings, { method: 'PUT', ...json(payload) })

export const getToken = (host: string, bu: string) =>
  call<TokenStatus>(API.emailAutomation.tokenFor(host, bu))

export const putToken = (host: string, bu: string, token: string) =>
  call<TokenStatus>(API.emailAutomation.token, { method: 'PUT', ...json({ host, bu, token }) })

export const deleteToken = (host: string, bu: string) =>
  call<void>(API.emailAutomation.tokenFor(host, bu), { method: 'DELETE' })
