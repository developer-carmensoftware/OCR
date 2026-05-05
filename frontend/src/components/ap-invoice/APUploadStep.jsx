import { UploadCloud, FolderOpen, Info } from 'lucide-react'

export default function APUploadStep({ t, fileInputRef, onFileChange }) {
  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFileChange({ target: { files: [f] } })
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
          ref={fileInputRef}
          accept="image/*,application/pdf"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
        <div className="upload-icon"><UploadCloud size={40} /></div>
        <div className="upload-label">{t.uploadTitle}</div>
        <div className="upload-hint">{t.uploadDesc}</div>
        <button
          className="btn btn-primary"
          style={{ marginTop: '1.5rem' }}
          onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
        >
          <FolderOpen size={14} /> {t.uploadBtn}
        </button>
      </div>

      <div className="panel-card" style={{ marginTop: '1rem' }}>
        <div className="field-label"><Info size={16} /> วิธีใช้งาน AP Invoice OCR</div>
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
  { n: 1, c: 'gold', text: 'อัปโหลดไฟล์ใบแจ้งหนี้ (JPG, PNG, PDF)' },
  { n: 2, c: 'gold', text: 'ตรวจสอบ Field Mapping ให้ตรงกับตารางในเอกสาร' },
  { n: 3, c: 'teal', text: 'ตรวจสอบข้อมูล Header และยอดเงิน' },
  { n: 4, c: 'teal', text: 'ผูกผังบัญชีแต่ละรายการ แล้วกด Generate Invoice' },
]
