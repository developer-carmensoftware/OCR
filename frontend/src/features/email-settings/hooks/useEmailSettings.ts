/**
 * State behind #/CreditCardOCR/email-settings.
 *
 * A dirty form with one Save: every control edits a local `draft`, and `save()` sends the
 * whole thing in a single `PUT /settings`, which is a full replace and answers with the new
 * state, so there is no reload-after-write. Bank rules are the exception (2026-10-01): the
 * page edits them in a dialog that saves at once, through `saveRules`. One PUT per editing session rather than one per
 * keystroke also matters: these endpoints are rate-limited to 20/min per IP.
 *
 * The draft holds the list fields as **raw text**, exactly as typed. Splitting on every
 * keystroke would eat the separator the user is halfway through typing; `splitList` runs
 * once, at save.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/shared/contexts/AuthContext'
import {
  EmailApiError,
  deleteToken,
  getBankCodes,
  getSettings,
  getToken,
  putToken,
  saveSettings,
  type BankCode,
  type EmailDocType,
  type EmailRulePayload,
  type EmailSettings,
  type TokenStatus,
} from '@/features/email-settings/api/emailAutomation'

/** One rule as the form edits it: the two list/secret fields are text, and
 *  `has_password` rides along read-only so the password label can say whether
 *  leaving it blank keeps something or nothing. */
export interface RuleDraft {
  bank_code: string
  bank_sender_email: string
  filename_patterns: string
  /** Write-only. '' = leave the stored password alone (never "clear it"). */
  pdf_password: string
  is_active: boolean
  doc_type: EmailDocType
  has_password: boolean
}

export interface Draft {
  enabled: boolean
  auto_post: boolean
  owner_emails: string
  tax_ids: string
  rules: RuleDraft[]
}

export const EMPTY_RULE: RuleDraft = {
  bank_code: '',
  bank_sender_email: '',
  filename_patterns: '',
  pdf_password: '',
  is_active: true,
  doc_type: 'fee_invoice',
  has_password: false,
}

const EMPTY_DRAFT: Draft = {
  enabled: false,
  auto_post: false,
  owner_emails: '',
  tax_ids: '',
  rules: [],
}

/** Commas or new lines, either way, blanks dropped. The only parser on this screen. */
export const splitList = (text: string): string[] =>
  text
    .split(/[,\n]/)
    .map(part => part.trim())
    .filter(Boolean)

/** The server's state in form shape. This is the one function that decides what the form
 *  knows about, and therefore what `save()` can send: `rules` is a full replace, so a
 *  field missing here is a field the next save silently deletes from every rule the BU
 *  has. `doc_type` is what made that concrete — losing it turns a settlement report back
 *  into a commission invoice, read with the wrong layout and posted to the wrong
 *  accounts. */
export function seedDraft(settings: EmailSettings | null): Draft {
  if (!settings) return EMPTY_DRAFT
  return {
    enabled: settings.enabled,
    auto_post: settings.auto_post,
    owner_emails: (settings.owner_emails || []).join(', '),
    tax_ids: (settings.tax_ids || []).join(', '),
    rules: (settings.rules || []).map(r => ({
      bank_code: r.bank_code || '',
      bank_sender_email: r.bank_sender_email || '',
      filename_patterns: r.filename_patterns.join(', '),
      pdf_password: '',
      is_active: r.is_active,
      doc_type: r.doc_type || 'fee_invoice',
      has_password: Boolean(r.has_password),
    })),
  }
}

const toPayloadRules = (rules: RuleDraft[]): EmailRulePayload[] =>
  rules.map(r => ({
    bank_code: r.bank_code || null,
    bank_sender_email: r.bank_sender_email.trim() || null,
    filename_patterns: splitList(r.filename_patterns),
    is_active: r.is_active,
    doc_type: r.doc_type,
    // null = keep what is stored; '' would clear it. Only a typed value sets one.
    pdf_password: r.pdf_password || null,
  }))

export interface EmailSettingsController {
  loading: boolean
  saving: boolean
  host: string
  bu: string
  /** Last state the server confirmed. Read-only fields (address, status) come from here. */
  settings: EmailSettings | null
  /** What the form is editing. Nothing here has reached the server yet. */
  draft: Draft
  dirty: boolean
  banks: BankCode[]
  tokenStatus: TokenStatus | null
  /** Whole-request failure: 401 Carmen rejected, 409 tax ID clash, 502 unreachable. */
  error: { status: number; message: string } | null
  /** Per-input failures from `errors[]`, keyed by `field`. */
  fieldErrors: Record<string, string>
  /** Local only — no network. */
  patch: (p: Partial<Draft>) => void
  save: () => Promise<boolean>
  /** Saves a new rules list on its own, now. The other fields go out as the server last
   *  confirmed them, so an unsaved edit elsewhere on the page is neither sent nor lost. */
  saveRules: (rules: RuleDraft[]) => Promise<boolean>
  reset: () => void
  saveToken: (token: string) => Promise<boolean>
  removeToken: () => Promise<boolean>
  reload: () => Promise<void>
}

export function useEmailSettings(): EmailSettingsController {
  const { user } = useAuth()
  // The normalised `https://<host>` the backend returned at login, sent as-is: the
  // Settings API takes the origin and derives the hostname itself, the same way
  // /auth/exchange did when it created the tenant row. Nothing here parses it.
  const uri = user?.uri || ''
  const bu = user?.bu || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [banks, setBanks] = useState<BankCode[]>([])
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const seed = useMemo(() => seedDraft(settings), [settings])
  // ponytail: JSON compare over a ~10-field object, re-run per render. Memoise the
  // stringify if the draft ever grows past a handful of rules.
  const dirty = JSON.stringify(draft) !== JSON.stringify(seed)

  const report = useCallback((err: unknown) => {
    if (err instanceof EmailApiError) {
      setError({ status: err.status, message: err.message })
      setFieldErrors(err.fieldErrors)
    } else {
      setError({ status: 0, message: err instanceof Error ? err.message : 'Request failed' })
      setFieldErrors({})
    }
  }, [])

  const reload = useCallback(async () => {
    if (!uri || !bu) {
      // Nothing to ask for. Stop loading rather than leaving the skeleton up forever —
      // the page renders this as an error the user can act on.
      setLoading(false)
      setError({ status: 0, message: 'No Carmen session — reopen this page from Carmen.' })
      return
    }
    setLoading(true)
    try {
      // Bank codes come from the `banks` table via the API, never from the frontend
      // BANKS constant — CARMEN_INTEGRATION.md §2.3 is explicit that a second
      // hardcoded list is exactly what this endpoint exists to prevent.
      const [loaded, bankList, token] = await Promise.all([
        getSettings(uri, bu),
        getBankCodes().catch(() => [] as BankCode[]),
        getToken(uri, bu).catch(() => null),
      ])
      setSettings(loaded)
      setDraft(seedDraft(loaded))
      setBanks(bankList)
      setTokenStatus(token)
      setError(null)
      setFieldErrors({})
    } catch (err) {
      report(err)
    } finally {
      setLoading(false)
    }
  }, [uri, bu, report])

  useEffect(() => {
    void reload()
  }, [reload])

  const patch = useCallback((p: Partial<Draft>) => setDraft(prev => ({ ...prev, ...p })), [])

  const reset = useCallback(() => {
    setDraft(seed)
    setFieldErrors({})
  }, [seed])

  /** One PUT of the whole draft. Returns false on failure so the page keeps what was
   *  typed and can render the field errors beside it. */
  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    try {
      const next = await saveSettings({
        uri,
        bu,
        enabled: draft.enabled,
        owner_emails: splitList(draft.owner_emails),
        tax_ids: splitList(draft.tax_ids),
        rules: toPayloadRules(draft.rules),
        // **Sent only when this switch is what moved.** The server keeps the stored value
        // for a field the payload omits — the one exception to the full replace — so a
        // form whose copy went stale (a colleague flipping it on Carmen's screen while
        // this tab sat open) cannot turn review back off behind their back. A Save button
        // does not remove that race, it lengthens it.
        ...(draft.auto_post !== seed.auto_post ? { auto_post: draft.auto_post } : {}),
      })
      setSettings(next)
      // Reseeded from the response, not from the draft: the server normalises what it
      // stored, and the form should show that rather than what was typed.
      setDraft(seedDraft(next))
      setError(null)
      setFieldErrors({})
      return true
    } catch (err) {
      report(err)
      return false
    } finally {
      setSaving(false)
    }
  }, [uri, bu, draft, seed, report])

  /**
   * One rule added, edited, removed or switched, saved at once (the settings page's rule
   * dialog and row switch, 2026-10-01).
   *
   * `PUT /settings` is a full replace, so a rules save has to send the other fields too, and
   * it sends them **as the server last confirmed them** (`seed`), not as the draft holds them:
   * a tax ID the user is halfway through typing must not ride along with a rule. `auto_post`
   * is left out, which the endpoint reads as "keep". On success only the draft's rules are
   * replaced, so the page's other unsaved edits stay exactly where they were, still unsaved.
   */
  const saveRules = useCallback(
    async (rules: RuleDraft[]): Promise<boolean> => {
      setSaving(true)
      try {
        const next = await saveSettings({
          uri,
          bu,
          enabled: seed.enabled,
          owner_emails: splitList(seed.owner_emails),
          tax_ids: splitList(seed.tax_ids),
          rules: toPayloadRules(rules),
        })
        setSettings(next)
        setDraft(prev => ({ ...prev, rules: seedDraft(next).rules }))
        setError(null)
        setFieldErrors({})
        return true
      } catch (err) {
        report(err)
        return false
      } finally {
        setSaving(false)
      }
    },
    [uri, bu, seed, report]
  )

  const saveToken = useCallback(
    async (token: string) => {
      setSaving(true)
      try {
        setTokenStatus(await putToken(uri, bu, token))
        setError(null)
        return true
      } catch (err) {
        report(err)
        return false
      } finally {
        setSaving(false)
      }
    },
    [uri, bu, report]
  )

  const removeToken = useCallback(async () => {
    setSaving(true)
    try {
      await deleteToken(uri, bu)
      // Not refetched: DELETE answers 204, and the cleared state is fully known.
      setTokenStatus({ configured: false, fingerprint: null, carmen_uri: null, verified_at: null })
      setError(null)
      return true
    } catch (err) {
      report(err)
      return false
    } finally {
      setSaving(false)
    }
  }, [uri, bu, report])

  return {
    loading,
    saving,
    // Reported by the server, not derived here — one tenant, one identity, whatever
    // spelling the request used. Blank until the first load answers.
    host: settings?.host || '',
    bu,
    settings,
    draft,
    dirty,
    banks,
    tokenStatus,
    error,
    fieldErrors,
    patch,
    save,
    saveRules,
    reset,
    saveToken,
    removeToken,
    reload,
  }
}
