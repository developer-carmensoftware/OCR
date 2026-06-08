import React from 'react'
import { UploadCloud, FolderOpen, Info, Loader2 } from 'lucide-react'

interface Props {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  fileName?: string
  multiple?: boolean
  pdfInfoLoading?: boolean
}

const INSTRUCTIONS = [
  { n: 1, c: 'gold', text: 'Upload the bank receipt file (JPG, PNG, PDF)' },
  { n: 2, c: 'gold', text: 'AI will detect the bank and extract data automatically' },
  { n: 3, c: 'teal', text: 'Review and edit the extracted data' },
  { n: 4, c: 'teal', text: 'Confirm accounting entries and submit to Carmen GL JV' },
]

export default function UploadSection({
  onFileChange,
  fileInputRef,
  fileName,
  multiple,
  pdfInfoLoading,
}: Props) {
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files?.[0]) {
      const fakeEvent = { target: { files: e.dataTransfer.files } }
      onFileChange(fakeEvent)
      if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div
        className="panel-card upload-drop"
        style={{
          minHeight: 260,
          cursor: pdfInfoLoading ? 'default' : 'pointer',
          pointerEvents: pdfInfoLoading ? 'none' : undefined,
        }}
        onClick={() => !pdfInfoLoading && fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="fileInput"
          aria-label="Upload document file"
          ref={fileInputRef}
          accept="image/*,application/pdf,.heic,.heif"
          multiple={multiple}
          onChange={e => onFileChange(e)}
          style={{ display: 'none' }}
        />
        {pdfInfoLoading ? (
          <>
            <div className="upload-icon" style={{ color: 'var(--primary)' }}>
              <Loader2 size={40} className="animate-spin" />
            </div>
            <div className="upload-label" style={{ color: 'var(--primary)' }}>
              Reading PDF pages…
            </div>
            <div className="upload-hint">Detecting page count, this will only take a moment</div>
          </>
        ) : (
          <>
            <div className="upload-icon">
              <UploadCloud size={40} />
            </div>
            <div className="upload-label">
              {fileName
                ? fileName.length > 32
                  ? fileName.slice(0, 29) + '…'
                  : fileName
                : 'Click or drag file here'}
            </div>
            <div className="upload-hint">Supports JPG · PNG · PDF · HEIC · up to 20 MB</div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '1.5rem' }}
              onClick={e => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <FolderOpen size={14} /> Browse File
            </button>
          </>
        )}
      </div>

      <div className="panel-card" style={{ marginTop: '1rem' }}>
        <div className="field-label">
          <Info size={16} /> How to use
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
