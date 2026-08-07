/**
 * State behind #/email-settings.
 *
 * One shape decides everything else here: `PUT /settings` is a **full replace**, and
 * it returns the same body `GET` does. So there is no dirty state, no Save button and
 * no reload-after-write — every mutation hands the server the complete current
 * settings and swaps in whatever comes back. That also halves the traffic, which
 * matters: the settings endpoints are rate-limited to 20/min per IP.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  EmailApiError,
  deleteToken,
  getBankCodes,
  getSettings,
  getToken,
  putToken,
  saveSettings,
  type BankCode,
  type EmailRulePayload,
  type EmailSettings,
  type SettingsPayload,
  type TokenStatus,
} from '../../lib/api/emailAutomation'

export interface EmailSettingsController {
  loading: boolean
  saving: boolean
  host: string
  bu: string
  settings: EmailSettings | null
  banks: BankCode[]
  tokenStatus: TokenStatus | null
  /** Whole-request failure: 401 Carmen rejected, 409 tax ID clash, 502 unreachable. */
  error: { status: number; message: string } | null
  /** Per-input failures from `errors[]`, keyed by `field`. */
  fieldErrors: Record<string, string>
  setEnabled: (enabled: boolean) => Promise<boolean>
  setOwnerEmails: (emails: string[]) => Promise<boolean>
  setTaxIds: (taxIds: string[]) => Promise<boolean>
  setRules: (rules: EmailRulePayload[]) => Promise<boolean>
  saveToken: (token: string) => Promise<boolean>
  removeToken: () => Promise<boolean>
  reload: () => Promise<void>
}

/** The rules we hold are read-shape (`has_password`); the write shape drops that and
 *  omits `pdf_password` so the stored one is kept. */
function toPayloadRules(settings: EmailSettings | null): EmailRulePayload[] {
  return (settings?.rules || []).map(r => ({
    bank_code: r.bank_code,
    bank_sender_email: r.bank_sender_email,
    filename_patterns: r.filename_patterns,
    is_active: r.is_active,
  }))
}

function hostOf(uri: string | undefined): string {
  if (!uri) return ''
  try {
    return new URL(uri).hostname
  } catch {
    return ''
  }
}

export function useEmailSettings(): EmailSettingsController {
  const { user } = useAuth()
  // `uri` is the normalised `https://<host>` the backend returned at login, so this
  // parses — but a render-time throw here would blank the page, and a missing host is
  // already a state the screen renders ("—").
  const host = hostOf(user?.uri)
  const bu = user?.bu || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [banks, setBanks] = useState<BankCode[]>([])
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
    if (!host || !bu) {
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
        getSettings(host, bu),
        getBankCodes().catch(() => [] as BankCode[]),
        getToken(host, bu).catch(() => null),
      ])
      setSettings(loaded)
      setBanks(bankList)
      setTokenStatus(token)
      setError(null)
      setFieldErrors({})
    } catch (err) {
      report(err)
    } finally {
      setLoading(false)
    }
  }, [host, bu, report])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Send the whole thing, with one part overridden. Returns false on failure so the
   *  caller can keep its inline form open instead of discarding what was typed. */
  const put = useCallback(
    async (patch: Partial<Omit<SettingsPayload, 'host' | 'bu'>>): Promise<boolean> => {
      setSaving(true)
      try {
        const next = await saveSettings({
          host,
          bu,
          enabled: settings?.enabled ?? false,
          owner_emails: settings?.owner_emails || [],
          tax_ids: settings?.tax_ids || [],
          rules: toPayloadRules(settings),
          ...patch,
        })
        setSettings(next)
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
    [host, bu, settings, report]
  )

  const saveToken = useCallback(
    async (token: string) => {
      setSaving(true)
      try {
        setTokenStatus(await putToken(host, bu, token))
        setError(null)
        return true
      } catch (err) {
        report(err)
        return false
      } finally {
        setSaving(false)
      }
    },
    [host, bu, report]
  )

  const removeToken = useCallback(async () => {
    setSaving(true)
    try {
      await deleteToken(host, bu)
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
  }, [host, bu, report])

  return {
    loading,
    saving,
    host,
    bu,
    settings,
    banks,
    tokenStatus,
    error,
    fieldErrors,
    setEnabled: enabled => put({ enabled }),
    setOwnerEmails: owner_emails => put({ owner_emails }),
    setTaxIds: tax_ids => put({ tax_ids }),
    setRules: rules => put({ rules }),
    saveToken,
    removeToken,
    reload,
  }
}
