import React from 'react'
import { UploadCloud, FolderOpen, Info, Loader2 } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'

interface Props {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  fileName?: string
  fileCount?: number
  pdfInfoLoading?: boolean
  imageMerging?: boolean
}

const INSTRUCTIONS: { n: number; c: string; key: TKey }[] = [
  { n: 1, c: 'gold', key: 'cc.howTo1' },
  { n: 2, c: 'gold', key: 'cc.howTo2' },
  { n: 3, c: 'teal', key: 'cc.howTo3' },
  { n: 4, c: 'teal', key: 'cc.howTo4' },
]

export default function UploadSection({
  onFileChange,
  fileInputRef,
  fileName,
  fileCount,
  pdfInfoLoading,
  imageMerging,
}: Props) {
  const { t } = useT()
  const busy = pdfInfoLoading || imageMerging

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) {
      const fakeEvent = { target: { files: e.dataTransfer.files } }
      onFileChange(fakeEvent)
      if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files
    }
  }

  const displayLabel =
    fileCount && fileCount > 1
      ? t('cc.imagesSelected', { n: fileCount })
      : fileName
        ? fileName.length > 32
          ? fileName.slice(0, 29) + '…'
          : fileName
        : t('cc.dropHint')

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div
        className="panel-card upload-drop"
        style={{
          minHeight: 260,
          cursor: busy ? 'default' : 'pointer',
          pointerEvents: busy ? 'none' : undefined,
        }}
        onClick={() => !busy && fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="fileInput"
          aria-label="Upload document file"
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
              {t('cc.merging', { n: fileCount ?? 0 })}
            </div>
            <div className="upload-hint">{t('cc.mergingHint')}</div>
          </>
        ) : pdfInfoLoading ? (
          <>
            <div className="upload-icon" style={{ color: 'var(--primary)' }}>
              <Loader2 size={40} className="animate-spin" />
            </div>
            <div className="upload-label" style={{ color: 'var(--primary)' }}>
              {t('cc.readingPdf')}
            </div>
            <div className="upload-hint">{t('cc.readingPdfHint')}</div>
          </>
        ) : (
          <>
            <div className="upload-icon">
              <UploadCloud size={40} />
            </div>
            <div className="upload-label">{displayLabel}</div>
            <div className="upload-hint">{t('cc.uploadSupports')}</div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '1.5rem' }}
              onClick={e => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <FolderOpen size={14} /> {t('cc.browseFile')}
            </button>
          </>
        )}
      </div>

      <div className="panel-card" style={{ marginTop: '1rem' }}>
        <div className="field-label">
          <Info size={16} /> {t('cc.howTo')}
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
