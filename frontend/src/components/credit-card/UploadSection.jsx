import { useState } from 'react'
import { Landmark, MousePointer2, Check, UploadCloud, Lock, Info } from 'lucide-react'
import { BANKS } from '../../constants'

export default function UploadSection({ bank, onBankChange, onFileChange, fileInputRef, fileName, multiple }) {
  const [isDragOver, setIsDragOver] = useState(false)

  const hasBank = !!bank

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const fakeEvent = { target: { files: e.dataTransfer.files } }
      onFileChange(fakeEvent)
      if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files
    }
  }

  return (
    <div className="upload-section">
      {/* Bank Selector */}
      <div className={`panel-card ${!hasBank ? 'step-active' : ''}`}>
        <div className="field-label">
          <Landmark size={16} /> Select Bank
          {!hasBank
            ? <span className="step-badge badge-now"><MousePointer2 size={11} /> Start Here</span>
            : <span className="step-badge badge-now" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--emerald)', border: '1px solid rgba(16,185,129,0.2)' }}><Check size={11} /> Selected</span>
          }
        </div>
        <div className="bank-select-grid">
          {BANKS.map((b) => {
            const isSelected = bank === b.value
            return (
              <label
                key={b.value}
                className={`bank-option ${isSelected ? 'selected' : ''}`}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') onBankChange(b.value) }}
              >
                <input
                  type="radio"
                  name="bank"
                  value={b.value}
                  checked={isSelected}
                  onChange={(e) => onBankChange(e.target.value)}
                />
                <div className="bank-dot"></div>
                <span className="bank-name">{b.label}</span>
                <span className="bank-code">{b.value}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* File Upload Drop Zone */}
      <div
        className={`panel-card upload-drop ${isDragOver ? 'dragover' : ''} ${hasBank ? 'step-active-upload' : 'step-dimmed'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={hasBank ? 0 : -1}
        aria-label="Upload document file"
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') fileInputRef.current?.click() }}
      >
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          accept="image/*, application/pdf"
          multiple={multiple}
          onChange={onFileChange}
          aria-hidden="true"
        />
        <div className="upload-icon">
          {hasBank ? <UploadCloud size={32} /> : <Lock size={32} />}
        </div>
        <div className="upload-label">
          {!hasBank
            ? 'Select a bank first'
            : fileName
              ? (fileName.length > 28 ? fileName.slice(0, 25) + '…' : fileName)
              : 'Click or drag file here'
          }
        </div>
        <div className="upload-hint">
          {hasBank ? 'Supports JPG · PNG · PDF' : 'Step 2'}
        </div>
      </div>

      {/* How-to Card */}
      <div className="panel-card">
        <div className="field-label"><Info size={16} /> How to use</div>
        <div className="how-to-list">
          <div className="how-to-item">
            <div className="how-step-num gold">1</div>
            <span>Select the bank that matches the document</span>
          </div>
          <div className="how-to-item">
            <div className="how-step-num gold">2</div>
            <span>Upload report file (Image or PDF)</span>
          </div>
          <div className="how-to-item">
            <div className="how-step-num gold">3</div>
            <span>AI will extract data automatically upon file selection</span>
          </div>
          <div className="how-to-item">
            <div className="how-step-num teal">4</div>
            <span>Review the data and click Submit</span>
          </div>
        </div>
      </div>
    </div>
  )
}
