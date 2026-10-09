import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/shared/contexts/AuthContext'
import { exchangeSSOToken } from '@/shared/api/auth'
import { CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY } from '@/shared/api/client'

export interface CarmenSSOState {
  exchanging: boolean
  error: string | null
}

/** The SSO parameters Carmen's link carries in the hash, or null when it carries no `token`. */
export function ssoLink(hash: string) {
  const qIndex = hash.indexOf('?')
  if (qIndex === -1) return null
  const params = new URLSearchParams(hash.slice(qIndex + 1))
  const token = params.get('token')
  if (!token) return null
  return {
    token,
    bu: params.get('bu') || params.get('BU') || '',
    user: params.get('user') || params.get('User') || '',
    uri: params.get('uri') || '',
    params,
    qIndex,
  }
}

/**
 * Signs in from Carmen's link, once per mount. A link that lands in a tab already running
 * the app is not this hook's job: main.tsx reloads the page for it (CA-121), so it arrives
 * here as a fresh mount like any new tab.
 */
export function useCarmenSSO(): CarmenSSOState {
  const { login } = useAuth()
  // True from the first render when there is a link to exchange, so ProtectedRoute never
  // shows a page as the previous session, or "Access via Carmen", before the exchange starts.
  const [exchanging, setExchanging] = useState(() => !!ssoLink(window.location.hash)?.bu)
  const [error, setError] = useState<string | null>(null)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const hash = window.location.hash
    const link = ssoLink(hash)
    if (!link) return

    // The token leaves the address bar (and history) first, whatever happens next.
    const cleanHash = hash.slice(0, link.qIndex) || '#/'
    window.history.replaceState(null, '', window.location.pathname + cleanHash)

    const { token, bu, user, uri, params } = link
    if (!bu) {
      setError("This link from Carmen is missing its business unit. Reopen it from Carmen's menu.")
      return
    }

    // #/CreditCardOCR/email-settings calls `/api/v1/carmen/*` with this exact token, which proves it
    // against the customer's Carmen on every call — 401 "re-login", 502 "cannot reach
    // Carmen", 429. Carmen's menu opens that page through this same link (decision #34).
    // sessionStorage, same lifetime and blast radius as `ocr_access_token`.
    sessionStorage.setItem(CARMEN_RAW_TOKEN_KEY, token)
    // Only the settings link carries it: a BU posting token Carmen minted for this open,
    // which killed the one we hold (decision #35). Stashed, not sent: the settings page
    // stores it once /exchange has created the tenant it belongs to.
    // Agreed with Carmen: one token. The settings link carries only `token`, and that same
    // value is the posting credential; `posting_token` stays honoured if Carmen sends one.
    // Settings link only: the queue's link must not overwrite the stored credential.
    // #/pms carries it too: PMS days are read and posted with the same one credential
    // (decision #42), and that page stores it the same way.
    const postingToken =
      params.get('posting_token') ||
      (hash.includes('email-settings?') || /^#\/pms\?/i.test(hash) ? token : null)
    if (postingToken) sessionStorage.setItem(CARMEN_POSTING_TOKEN_KEY, postingToken)

    setExchanging(true)
    setError(null)

    exchangeSSOToken(token, bu, user, uri)
      .then(({ access_token, user: userInfo }) => {
        login(access_token, userInfo)
      })
      .catch((err: Error) => {
        setError(err.message || 'Authentication failed')
      })
      .finally(() => {
        setExchanging(false)
      })
  }, [login])

  return { exchanging, error }
}
