import React, { useRef, useState } from 'react'
import { UploadCloud, Loader2, FileCheck2, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import CustomModal from '../common/CustomModal'
import { useT } from '../../i18n/LanguageContext'
import { MAX_FILE_SIZE_MB } from '../../lib/fileValidation'

const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const WARNING_ID = 'slip-plan-change-warning'

interface Props {
  onUpload: (file: File) => Promise<void>
  uploading: boolean
  /**
   * ponytail: starts in the chosen-file state instead of the drop zone. Exists so
   * the purchase tutorial's figure can show the Confirm button — its canvas is
   * `inert`, so nothing there can pick a file.
   */
  initialFile?: File | null
  /**
   * Consequence to confirm before uploading. Set only when this order changes the
   * buyer's plan for the worse — the guard lives here, not in the callers, because
   * the pending-order banner reaches this button without passing through checkout.
   */
  warning?: string
}

/** Payment-slip drop zone — reuses the signature upload-drop visual language. */
export default function SlipUpload({ onUpload, uploading, initialFile, warning }: Props) {
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(initialFile ?? null)
  const [dragging, setDragging] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const accept = (f: File | undefined) => {
    if (!f) return
    if (!ACCEPTED.includes(f.type)) {
      toast.error(t('slip.errType'))
      return
    }
    if (f.size > MAX_BYTES) {
      toast.error(t('slip.errSize'))
      return
    }
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragging(false)
    accept(e.dataTransfer.files?.[0])
  }

  const run = async () => {
    if (!file) return
    // Close first: the Confirm button behind it already owns the uploading spinner
    // and disables itself, so the modal has nothing left to show.
    setConfirming(false)
    try {
      await onUpload(file)
    } catch {
      /* error surfaced by caller via toast */
    }
  }

  const submit = () => (warning ? setConfirming(true) : run())

  // Shown as soon as this order is known to be a downgrade — while the buyer still has
  // the proforma up and hasn't transferred yet — not only in the confirm dialog below,
  // which by definition only fires once they already have a slip in hand.
  const warningBanner = warning && (
    <div className="mapping-alert">
      <AlertTriangle size={16} />
      <span id={WARNING_ID}>{warning}</span>
    </div>
  )
  // Static text a keyboard user tabs straight past, so point the button at it. Preferred
  // over role="alert", which announces on insertion only — the pending-order path renders
  // this banner at page load, where that never fires.
  const describedBy = warning ? WARNING_ID : undefined

  if (file) {
    return (
      <div className="slip-chosen">
        {warningBanner}
        <div className="slip-chosen-file">
          <FileCheck2 size={18} className="slip-chosen-icon" />
          <span className="slip-chosen-name">{file.name}</span>
          {!uploading && (
            <button
              type="button"
              className="slip-chosen-clear"
              onClick={() => setFile(null)}
              aria-label={t('slip.chooseDifferent')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary slip-submit"
          onClick={submit}
          disabled={uploading}
          aria-describedby={describedBy}
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> {t('slip.submitting')}
            </>
          ) : (
            t('checkout.confirmPayment')
          )}
        </button>
        <CustomModal
          show={confirming}
          type="warning"
          title={t('slip.changeTitle')}
          message={warning}
          confirmText={t('checkout.confirmPayment')}
          cancelText={t('modal.cancel')}
          confirmVariant="danger"
          onConfirm={run}
          onCancel={() => setConfirming(false)}
        />
      </div>
    )
  }

  return (
    <>
      {warningBanner}
      <button
        type="button"
        className={`panel-card upload-drop slip-drop${dragging ? ' is-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
        aria-describedby={describedBy}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={e => accept(e.target.files?.[0])}
          style={{ display: 'none' }}
          aria-label={t('slip.uploadLabel')}
        />
        <div className="upload-icon">
          <UploadCloud size={34} />
        </div>
        <div className="upload-label">{t('slip.uploadLabel')}</div>
        <div className="upload-hint">{t('slip.uploadHint')}</div>
      </button>
    </>
  )
}
