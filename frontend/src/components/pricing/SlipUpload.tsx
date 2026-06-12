import React, { useRef, useState } from 'react'
import { UploadCloud, Loader2, FileCheck2, X } from 'lucide-react'
import { toast } from 'sonner'

const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 20 * 1024 * 1024

interface Props {
  onUpload: (file: File) => Promise<void>
  uploading: boolean
}

/** Payment-slip drop zone — reuses the signature upload-drop visual language. */
export default function SlipUpload({ onUpload, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (f: File | undefined) => {
    if (!f) return
    if (!ACCEPTED.includes(f.type)) {
      toast.error('Only JPG, PNG, or PDF files are supported')
      return
    }
    if (f.size > MAX_BYTES) {
      toast.error('File exceeds 20 MB')
      return
    }
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
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
              aria-label="Choose a different file"
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
              <Loader2 size={14} className="animate-spin" /> Submitting…
            </>
          ) : (
            'Confirm payment'
          )}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`panel-card upload-drop slip-drop${dragging ? ' is-dragging' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={e => accept(e.target.files?.[0])}
        style={{ display: 'none' }}
        aria-label="Upload payment slip"
      />
      <div className="upload-icon">
        <UploadCloud size={34} />
      </div>
      <div className="upload-label">Upload payment slip</div>
      <div className="upload-hint">Click or drag a file here · JPG · PNG · PDF · up to 20 MB</div>
    </div>
  )
}
