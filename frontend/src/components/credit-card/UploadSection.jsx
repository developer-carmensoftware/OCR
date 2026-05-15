import { UploadCloud, FolderOpen, Info } from 'lucide-react'

export default function UploadSection({ onFileChange, fileInputRef, fileName, multiple }) {
  const handleDrop = e => {
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
        style={{ minHeight: 260, cursor: 'pointer' }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          accept="image/*, application/pdf"
          multiple={multiple}
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
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
        <div className="upload-hint">Supports JPG · PNG · PDF · up to 20 MB</div>
        <button
          className="btn btn-primary"
          style={{ marginTop: '1.5rem' }}
          onClick={e => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          <FolderOpen size={14} /> Browse File
        </button>
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

const INSTRUCTIONS = [
  { n: 1, c: 'gold', text: 'Upload the bank receipt file (JPG, PNG, PDF)' },
  { n: 2, c: 'gold', text: 'AI will detect the bank and extract data automatically' },
  { n: 3, c: 'teal', text: 'Review and edit the extracted data' },
  { n: 4, c: 'teal', text: 'Confirm accounting entries and submit to Carmen GL JV' },
]
