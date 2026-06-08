import type { ReactNode } from 'react'
import { ChevronLeft, FileText } from 'lucide-react'
import DocumentPreview from './DocumentPreview'

interface SelectedPageThumb {
  thumb: string
  pageNum: number
}

interface Props {
  showPreview: boolean
  onToggle: (show: boolean) => void
  previewUrl?: string | null
  previewType?: string | null
  fileName?: string
  selectedPageThumbs?: SelectedPageThumb[] | null
  children: ReactNode
}

export default function SplitLayout({
  showPreview,
  onToggle,
  previewUrl,
  previewType,
  fileName,
  selectedPageThumbs,
  children,
}: Props) {
  return (
    <div className={`ap-split-layout ${!showPreview ? 'full-width' : ''}`}>
      {showPreview && (
        <div className="ap-preview-side">
          <DocumentPreview
            previewUrl={previewUrl}
            previewType={previewType}
            fileName={fileName}
            selectedPageThumbs={selectedPageThumbs}
          />
          <button type="button" className="preview-toggle-btn hide" onClick={() => onToggle(false)}>
            <ChevronLeft size={14} /> Hide Document
          </button>
        </div>
      )}
      {!showPreview && (
        <button type="button" className="preview-toggle-btn show" onClick={() => onToggle(true)}>
          <FileText size={14} /> View Document
        </button>
      )}
      <div className="ap-work-area">{children}</div>
    </div>
  )
}
