import { useState, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Bug, X, Send, CheckCircle2, Paperclip, ImageOff } from 'lucide-react'
import { apiFetch } from '../../lib/api/client'
import '../../styles/components/header-modals.css'

interface Props {
  module: string
}

const CATEGORIES = [
  { value: 'ui', label: 'UI / Display' },
  { value: 'extraction', label: 'OCR Extraction' },
  { value: 'mapping', label: 'Mapping' },
  { value: 'submit', label: 'Submission / Export' },
  { value: 'other', label: 'Other' },
]

const MAX_BYTES = 1_048_576 // 1 MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function BugReportButton({ module }: Props) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('ui')
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<{ b64: string; mime: string; name: string } | null>(
    null
  )
  const [screenshotError, setScreenshotError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setCategory('ui')
    setDescription('')
    setScreenshot(null)
    setScreenshotError('')
    setError('')
    setSent(false)
  }

  const handleClose = () => {
    setOpen(false)
    reset()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      setScreenshotError('Image too large — max 1 MB.')
      return
    }
    setScreenshotError('')
    const b64 = await fileToBase64(file)
    setScreenshot({ b64, mime: file.type, name: file.name })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!description.trim()) return
    setSending(true)
    setError('')
    try {
      await apiFetch('/api/v1/feedback/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          category,
          description: description.trim(),
          screenshot_b64: screenshot?.b64 ?? null,
          screenshot_mime: screenshot?.mime ?? null,
        }),
      })
      setSent(true)
      setTimeout(handleClose, 1800)
    } catch {
      setError('Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const disabled = sending || sent

  return (
    <>
      <button
        type="button"
        className="btn-icon"
        title="Report a bug — coming soon"
        disabled
        aria-disabled="true"
      >
        <Bug size={15} strokeWidth={2} />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div className="hm-overlay" role="dialog" aria-modal="true" aria-label="Bug Report">
            <div className="hm-backdrop" onClick={handleClose} />
            <div className="hm-dialog">
              <div className="hm-header">
                <Bug size={15} className="hm-header-icon" strokeWidth={2} />
                <span className="hm-header-title">Bug Report</span>
                <button type="button" className="hm-close" onClick={handleClose} aria-label="Close">
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="hm-body">
                <div className="hm-field">
                  <label htmlFor="br-category" className="hm-label">
                    Category
                  </label>
                  <select
                    id="br-category"
                    className="hm-select"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    disabled={disabled}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hm-field">
                  <label htmlFor="br-description" className="hm-label">
                    Description
                  </label>
                  <textarea
                    id="br-description"
                    className="hm-textarea"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what happened and how to reproduce it…"
                    rows={4}
                    required
                    disabled={disabled}
                  />
                </div>

                {/* Screenshot attachment */}
                <div className="hm-field">
                  <span className="hm-label">Screenshot (optional)</span>
                  {screenshot ? (
                    <div className="hm-screenshot-preview">
                      <img
                        src={`data:${screenshot.mime};base64,${screenshot.b64}`}
                        alt="screenshot preview"
                        className="hm-screenshot-thumb"
                      />
                      <span className="hm-screenshot-name">{screenshot.name}</span>
                      {!disabled && (
                        <button
                          type="button"
                          className="hm-screenshot-remove"
                          onClick={() => setScreenshot(null)}
                          aria-label="Remove screenshot"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="hm-attach-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={disabled}
                    >
                      <Paperclip size={13} />
                      Attach image
                    </button>
                  )}
                  {screenshotError && (
                    <span className="hm-screenshot-err">
                      <ImageOff size={12} /> {screenshotError}
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hm-file-input"
                    onChange={e => {
                      void handleFileChange(e)
                    }}
                    aria-label="Attach screenshot"
                  />
                </div>

                {error && <p className="hm-error">{error}</p>}

                <button
                  type="submit"
                  className={`hm-btn-submit${sent ? ' hm-btn-submit--success' : ''}`}
                  disabled={disabled || !description.trim()}
                >
                  {sent ? (
                    <>
                      <CheckCircle2 size={14} /> Sent — thank you!
                    </>
                  ) : sending ? (
                    'Sending…'
                  ) : (
                    <>
                      <Send size={13} /> Submit Report
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
