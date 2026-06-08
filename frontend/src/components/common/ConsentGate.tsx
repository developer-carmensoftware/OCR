import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useUserConsent } from '../../hooks/useUserConsent'
import UserConsentModal from './UserConsentModal'

interface Props {
  children: ReactNode
}

export function ConsentGate({ children }: Props) {
  const { user } = useAuth()
  const { hasConsented, giveConsent } = useUserConsent(user)

  return (
    <>
      {children}
      <UserConsentModal show={!!user && !hasConsented} onConfirm={giveConsent} />
    </>
  )
}
