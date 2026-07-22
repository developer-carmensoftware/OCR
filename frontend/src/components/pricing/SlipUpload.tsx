import React, { useRef, useState } from 'react'
import { UploadCloud, Loader2, FileCheck2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '../../i18n/LanguageContext'
import { MAX_FILE_SIZE_MB } from '../../lib/fileValidation'

const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

interface Props {
  onUpload: (file: File) => Promise<void>
  uploading: boolean
}

/** Payment-slip drop zone — reuses the signature upload-drop visual language. */
export default function SlipUpload({ onUpload, uploading }: Props) {
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

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

  const submit = async () => {
    if (!file) return
    try {
      await onUpload(file)
    } catch {
      /* error surfaced by caller via toast */
    }
  }

  if (file) {
    return (
      <div className="slip-chosen">
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
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> {t('slip.submitting')}
            </>
          ) : (
            t('checkout.confirmPayment')
          )}
        </button>
      </div>
    )
  }

  return (
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
  )
}
