import type React from 'react'
import { useState } from 'react'
import { UploadCloud, FolderOpen, Info } from 'lucide-react'

interface Props {
  t: Record<string, string>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => void
}

const INSTRUCTIONS = [
  { n: 1, c: 'gold', text: 'Upload invoice file (JPG, PNG, PDF)' },
  { n: 2, c: 'gold', text: 'Verify Field Mapping against the document table' },
  { n: 3, c: 'teal', text: 'Review Header data and amounts' },
  { n: 4, c: 'teal', text: 'Map GL accounts for each item, then click Generate Invoice' },
]

export default function APUploadStep({ t, fileInputRef, onFileChange }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDropping, setIsDropping] = useState(false)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the drop zone itself, not children
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    setIsDropping(true)
    // Brief press-feedback before handing off — Emil's "received" beat
    window.setTimeout(() => setIsDropping(false), 140)
    const f = e.dataTransfer.files[0]
    if (f) onFileChange({ target: { files: [f] } })
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div
        className={`panel-card upload-drop${isDragOver ? ' dragover' : ''}${isDropping ? ' dropping' : ''}`}
        style={{ minHeight: 260, cursor: 'pointer' }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          aria-label="Upload invoice file"
          ref={fileInputRef}
          accept="image/*,application/pdf"
          onChange={e => onFileChange(e)}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">
          <UploadCloud size={40} />
        </div>
        <div className="upload-label">{t.uploadTitle}</div>
        <div className="upload-hint">{t.uploadDesc}</div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '1.5rem' }}
          onClick={e => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          <FolderOpen size={14} /> {t.uploadBtn}
        </button>
      </div>
      <div className="panel-card" style={{ marginTop: '1rem' }}>
        <div className="field-label">
          <Info size={16} /> How to use AP Invoice OCR
        </div>
        <div className="how-to-list">
          {INSTRUCTIONS.map(({ n, c, text }) => (
            <div key={n} className="how-to-item">
              <div className={`how-step-num ${c}`}>{n}</div>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
