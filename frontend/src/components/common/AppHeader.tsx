import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import logo from '../../assets/logo.png'
import { getCarmenUrl } from '../../lib/url'

interface Props {
  module?: string
  moduleName?: string
  eyebrow?: string
  backPath?: string
  onBack?: () => void
  backLabel?: string
  children?: ReactNode
}

export default function AppHeader({
  module,
  moduleName,
  eyebrow = 'Carmen Cloud · OCR Module',
  backPath,
  onBack,
  backLabel = 'Carmen',
  children,
}: Props) {
  const handleBack = () => {
    if (onBack) onBack()
    else if (backPath) window.location.href = getCarmenUrl(backPath)
    else window.location.hash = '#/'
  }

  return (
    <header className="app-header" data-module={module}>
      <button
        type="button"
        className="app-header-back"
        onClick={handleBack}
        aria-label={`Back to ${backLabel}`}
      >
        <ArrowLeft size={14} strokeWidth={2.25} />
        <span>{backLabel}</span>
      </button>
      <div className="app-header-sep" aria-hidden="true" />
      <div className="brand">
        <div className="logo-box">
          <img src={logo} alt="" className="logo-img" />
        </div>
        <div className="brand-text">
          <div className="app-header-eyebrow">{eyebrow}</div>
          <h1 className="app-header-title">{moduleName}</h1>
        </div>
      </div>
      <div className="app-header-actions">{children}</div>
    </header>
  )
}
