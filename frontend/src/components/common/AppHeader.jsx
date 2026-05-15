import { ArrowLeft } from 'lucide-react'
import logo from '../../assets/logo.png'
import { getCarmenUrl } from '../../lib/url'

export default function AppHeader({
  module,
  moduleName,
  eyebrow = 'Carmen Cloud · OCR Module',
  backPath,
  children,
}) {
  const handleBack = () => {
    if (backPath) {
      window.location.href = getCarmenUrl(backPath)
    } else {
      window.location.hash = '#/'
    }
  }

  return (
    <header className="app-header" data-module={module}>
      <button
        type="button"
        className="app-header-back"
        onClick={handleBack}
        aria-label="Back to Carmen"
      >
        <ArrowLeft size={14} strokeWidth={2.25} />
        <span>Carmen</span>
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
