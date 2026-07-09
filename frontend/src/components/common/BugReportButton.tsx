import { useRef, useReducer, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { Bug, X, Send, CheckCircle2, Paperclip, ImageOff } from 'lucide-react'
import { apiFetch } from '../../lib/api/client'
import { API } from '../../lib/api/endpoints'
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

interface BugReportState {
  open: boolean
  category: string
  description: string
  screenshot: { b64: string; mime: string; name: string } | null
  screenshotError: string
  sending: boolean
  sent: boolean
  error: string
}

type BugReportAction =
  | { type: 'SET_OPEN'; payload: boolean }
  | { type: 'SET_CATEGORY'; payload: string }
  | { type: 'SET_DESCRIPTION'; payload: string }
  | { type: 'SET_SCREENSHOT'; payload: { b64: string; mime: string; name: string } | null }
  | { type: 'SET_SCREENSHOT_ERROR'; payload: string }
  | { type: 'SET_SENDING'; payload: boolean }
  | { type: 'SET_SENT'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET' }

const initialBugReportState: BugReportState = {
  open: false,
  category: 'ui',
  description: '',
  screenshot: null,
  screenshotError: '',
  sending: false,
  sent: false,
  error: '',
}

function bugReportReducer(state: BugReportState, action: BugReportAction): BugReportState {
  switch (action.type) {
    case 'SET_OPEN':
      return { ...state, open: action.payload }
    case 'SET_CATEGORY':
      return { ...state, category: action.payload }
    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload }
    case 'SET_SCREENSHOT':
      return { ...state, screenshot: action.payload, screenshotError: '' }
    case 'SET_SCREENSHOT_ERROR':
      return { ...state, screenshotError: action.payload, screenshot: null }
    case 'SET_SENDING':
      return { ...state, sending: action.payload }
    case 'SET_SENT':
      return { ...state, sent: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'RESET':
      return {
        ...state,
        category: 'ui',
        description: '',
        screenshot: null,
        screenshotError: '',
        error: '',
        sent: false,
      }
    default:
      return state
  }
}

export default function BugReportButton({ module }: Props) {
  const [state, dispatch] = useReducer(bugReportReducer, initialBugReportState)
  const { open, category, description, screenshot, screenshotError, sending, sent, error } = state
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    dispatch({ type: 'SET_OPEN', payload: false })
    dispatch({ type: 'RESET' })
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      dispatch({ type: 'SET_SCREENSHOT_ERROR', payload: 'Image too large — max 1 MB.' })
      return
    }
    const b64 = await fileToBase64(file)
    dispatch({ type: 'SET_SCREENSHOT', payload: { b64, mime: file.type, name: file.name } })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!description.trim()) return
    dispatch({ type: 'SET_SENDING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: '' })
    try {
      await apiFetch(API.feedback.bugReport, {
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
      dispatch({ type: 'SET_SENT', payload: true })
      setTimeout(handleClose, 1800)
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SENDING', payload: false })
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
          <dialog
            className="hm-overlay hm-dialog-reset"
            aria-modal="true"
            aria-label="Bug Report"
            open
          >
            <button
              type="button"
              className="hm-backdrop"
              aria-label="Close bug report"
              onClick={handleClose}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                  e.preventDefault()
                  handleClose()
                }
              }}
            />
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
                    onChange={e => dispatch({ type: 'SET_CATEGORY', payload: e.target.value })}
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
                    onChange={e => dispatch({ type: 'SET_DESCRIPTION', payload: e.target.value })}
                    placeholder="Describe what happened and how to reproduce it…"
                    rows={4}
                    required
                    disabled={disabled}
                    aria-label="Description"
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
                          onClick={() => dispatch({ type: 'SET_SCREENSHOT', payload: null })}
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
          </dialog>,
          document.body
        )}
    </>
  )
}
