import type React from 'react'
import { useState } from 'react'
import { UploadCloud, FolderOpen, Info, Loader2 } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'

interface Props {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => void
  pdfInfoLoading?: boolean
  imageMerging?: boolean
  fileCount?: number
}

const INSTRUCTIONS: { n: number; c: string; key: TKey }[] = [
  { n: 1, c: 'gold', key: 'ap.howTo1' },
  { n: 2, c: 'gold', key: 'ap.howTo2' },
  { n: 3, c: 'teal', key: 'ap.howTo3' },
  { n: 4, c: 'teal', key: 'ap.howTo4' },
]

export default function APUploadStep({
  fileInputRef,
  onFileChange,
  pdfInfoLoading,
  imageMerging,
  fileCount,
}: Props) {
  const { t } = useT()
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDropping, setIsDropping] = useState(false)

  const busy = pdfInfoLoading || imageMerging

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    // Only clear when leaving the drop zone itself, not children
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    setIsDropping(true)
    // Brief press-feedback before handing off — Emil's "received" beat
    window.setTimeout(() => setIsDropping(false), 140)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFileChange({ target: { files } })
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <button
        type="button"
        className={`panel-card upload-drop${!busy && isDragOver ? ' dragover' : ''}${!busy && isDropping ? ' dropping' : ''}`}
        style={{
          minHeight: 260,
          cursor: busy ? 'default' : 'pointer',
          pointerEvents: busy ? 'none' : undefined,
        }}
        disabled={busy}
        onClick={() => !busy && fileInputRef.current?.click()}
        onKeyDown={e => {
          if (!busy && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragOver={busy ? undefined : handleDragOver}
        onDragLeave={busy ? undefined : handleDragLeave}
        onDrop={busy ? undefined : handleDrop}
      >
        <input
          type="file"
          aria-label="Upload invoice file"
          ref={fileInputRef}
          accept="image/*,application/pdf,.heic,.heif"
          multiple
          onChange={e => onFileChange(e)}
          style={{ display: 'none' }}
        />
        {imageMerging ? (
          <>
            <div className="upload-icon" style={{ color: 'var(--primary)' }}>
              <Loader2 size={40} className="animate-spin" />
            </div>
            <div className="upload-label" style={{ color: 'var(--primary)' }}>
              {t('ap.merging', { n: fileCount ?? 0 })}
            </div>
            <div className="upload-hint">{t('ap.mergingHint')}</div>
          </>
        ) : pdfInfoLoading ? (
          <>
            <div className="upload-icon" style={{ color: 'var(--primary)' }}>
              <Loader2 size={40} className="animate-spin" />
            </div>
            <div className="upload-label" style={{ color: 'var(--primary)' }}>
              {t('ap.readingPdf')}
            </div>
            <div className="upload-hint">{t('ap.readingPdfHint')}</div>
          </>
        ) : (
          <>
            <div className="upload-icon">
              <UploadCloud size={40} />
            </div>
            <div className="upload-label">{t('ap.uploadTitle')}</div>
            <div className="upload-hint">{t('ap.uploadDesc')}</div>
            <span
              className="btn btn-primary"
              style={{
                marginTop: '1.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FolderOpen size={14} /> {t('ap.uploadBtn')}
            </span>
          </>
        )}
      </button>
      <div className="panel-card" style={{ marginTop: '1rem' }}>
        <div className="field-label">
          <Info size={16} /> {t('ap.howTo')}
        </div>
        <div className="how-to-list">
          {INSTRUCTIONS.map(({ n, c, key }) => (
            <div key={n} className="how-to-item">
              <div className={`how-step-num ${c}`}>{n}</div>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
