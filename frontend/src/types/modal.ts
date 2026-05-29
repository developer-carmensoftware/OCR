export type ModalState =
  | { show: false }
  | {
      show: true
      type: 'info' | 'success' | 'warning' | 'error'
      title: string
      message: string
      confirmText?: string
      cancelText?: string
      onConfirm?: () => void
      onCancel?: () => void
      inputLabel?: string
      inputValue?: string
      onInputChange?: (v: string) => void
      inputPlaceholder?: string
    }
