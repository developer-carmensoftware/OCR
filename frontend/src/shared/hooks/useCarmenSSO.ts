import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/shared/contexts/AuthContext'
import { exchangeSSOToken } from '@/shared/api/auth'
import { CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY } from '@/shared/api/client'

export interface CarmenSSOState {
  exchanging: boolean
  error: string | null
}

export function useCarmenSSO(): CarmenSSOState {
  const { login } = useAuth()
  const [exchanging, setExchanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const hash = window.location.hash
    const qIndex = hash.indexOf('?')
    if (qIndex === -1) return

    const params = new URLSearchParams(hash.slice(qIndex + 1))
    const token = params.get('token')
    const bu = params.get('bu') || params.get('BU') || ''
    const user = params.get('user') || params.get('User') || ''
    const uri = params.get('uri') || ''

    if (!token || !bu) return

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
    const postingToken =
      params.get('posting_token') || (hash.includes('email-settings?') ? token : null)
    if (postingToken) sessionStorage.setItem(CARMEN_POSTING_TOKEN_KEY, postingToken)

    const cleanHash = hash.slice(0, qIndex) || '#/'
    window.history.replaceState(null, '', window.location.pathname + cleanHash)

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
