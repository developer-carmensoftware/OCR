import { useState } from 'react'

export interface ModalConfig {
  show: boolean
  title?: string
  message?: string
  type?: 'info' | 'success' | 'error' | 'warning'
  [key: string]: unknown
}

export function useModal() {
  const [modal, setModal] = useState<ModalConfig>({ show: false })

  function showModal(config: Omit<ModalConfig, 'show'>) {
    setModal({ show: true, ...config })
  }

  function closeModal() {
    setModal({ show: false })
  }

  return { modal, showModal, closeModal }
}
