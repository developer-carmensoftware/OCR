import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useUserConsent } from '../../hooks/useUserConsent'
import UserConsentModal from './UserConsentModal'

interface Props {
  children: ReactNode
}

export function ConsentGate({ children }: Props) {
  const { user } = useAuth()
  const { showConsent, giveConsent } = useUserConsent(user)

  return (
    <>
      {children}
      <UserConsentModal
        key={showConsent ? 'open' : 'closed'}
        show={showConsent}
        onConfirm={giveConsent}
      />
    </>
  )
}
