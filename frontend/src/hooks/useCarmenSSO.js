import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { exchangeSSOToken } from '../lib/api/auth'

export function useCarmenSSO() {
  const { login } = useAuth()
  const [exchanging, setExchanging] = useState(false)
  const [error, setError] = useState(null)
  const didRun = useRef(false)  // guard against React StrictMode double-invocation

  useEffect(() => {
    // StrictMode runs effects twice in dev — run only once
    if (didRun.current) return
    didRun.current = true

    // Parse token from hash: "/#/APInvoice?token=xxx&bu=yyy&user=zzz"
    const hash = window.location.hash
    const qIndex = hash.indexOf('?')
    if (qIndex === -1) return

    const params = new URLSearchParams(hash.slice(qIndex + 1))
    const token = params.get('token')
    const bu    = params.get('bu')   || params.get('BU')   || ''
    const user  = params.get('user') || params.get('User') || ''

    if (!token || !bu) return

    // Scrub URL immediately — token must not linger in browser history
    const cleanHash = hash.slice(0, qIndex) || '#/'
    window.history.replaceState(null, '', window.location.pathname + cleanHash)

    setExchanging(true)
    setError(null)

    exchangeSSOToken(token, bu, user)
      .then(({ access_token, user: userInfo }) => {
        login(access_token, userInfo)
      })
      .catch((err) => {
        setError(err.message || 'Authentication failed')
      })
      .finally(() => {
        setExchanging(false)
      })
  }, [login])

  return { exchanging, error }
}
