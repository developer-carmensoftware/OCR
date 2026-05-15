import { ChevronLeft, FileText } from 'lucide-react'
import DocumentPreview from './DocumentPreview'

/**
 * Split layout used on review steps: toggleable document preview on the left,
 * work area on the right. Eliminates the repeated pattern across
 * CreditCardOCR.jsx (steps 2 & 3) and APInvoice.jsx (steps 2 & 3).
 *
 * @param {boolean}   showPreview - Whether the preview pane is visible
 * @param {Function}  onToggle    - Called with true/false to show/hide preview
 * @param {string}    previewUrl  - URL of the document to preview
 * @param {string}    previewType - 'image' | 'pdf' | other
 * @param {string}    fileName    - Original file name (shown in preview)
 * @param {ReactNode} children    - The work area content
 */
export default function SplitLayout({
  showPreview,
  onToggle,
  previewUrl,
  previewType,
  fileName,
  children,
}) {
  return (
    <div className={`ap-split-layout ${!showPreview ? 'full-width' : ''}`}>
      {showPreview && (
        <div className="ap-preview-side">
          <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={fileName} />
          <button className="preview-toggle-btn hide" onClick={() => onToggle(false)}>
            <ChevronLeft size={14} /> Hide Document
          </button>
        </div>
      )}
      {!showPreview && (
        <button className="preview-toggle-btn show" onClick={() => onToggle(true)}>
          <FileText size={14} /> View Document
        </button>
      )}
      <div className="ap-work-area">{children}</div>
    </div>
  )
}
