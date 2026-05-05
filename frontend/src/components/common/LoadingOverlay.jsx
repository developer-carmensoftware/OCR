import { createPortal } from 'react-dom'

export default function LoadingOverlay({ show, title = 'AI is extracting data...', status }) {
  if (!show) return null
  return createPortal(
    <div className="ocr-loading-overlay">
      <div className="ocr-loading-box">
        <div className="ocr-loading-spinner" />
        <div className="ocr-loading-title">{title}</div>
        <div className="ocr-loading-status">{status || 'Please wait...'}</div>
      </div>
    </div>,
    document.body
  )
}
