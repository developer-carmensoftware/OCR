import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Eye,
  ZoomIn,
  ZoomOut,
  Minimize2,
  RotateCw,
  FileText,
  ExternalLink,
  FileImage,
  File,
} from 'lucide-react'

interface SelectedPageThumb {
  thumb: string
  pageNum: number
  label?: string
}

interface Props {
  previewUrl?: string | null
  previewType?: string | null
  fileName?: string
  selectedPageThumbs?: SelectedPageThumb[] | null
}

export default function DocumentPreview({
  previewUrl,
  previewType,
  fileName,
  selectedPageThumbs,
}: Props) {
  const [zoom, setZoom] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const frameRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<number | null>(null)

  useEffect(() => {
    setZoom(1)
    setRotate(0)
    setPan({ x: 0, y: 0 })
  }, [previewUrl])

  const handleWheel = useCallback((e: Event) => {
    e.preventDefault()
    const we = e as WheelEvent
    setZoom(prev => Math.min(Math.max(prev + (we.deltaY > 0 ? -0.15 : 0.15), 0.25), 5))
  }, [])

  const handleTouchStart = useCallback(
    (e: Event) => {
      const te = e as TouchEvent
      if (te.touches.length === 2) {
        const dx = te.touches[0].clientX - te.touches[1].clientX
        const dy = te.touches[0].clientY - te.touches[1].clientY
        pinchRef.current = Math.sqrt(dx * dx + dy * dy)
        return
      }
      if (te.touches.length === 1) {
        const touch = te.touches[0]
        setIsDragging(true)
        setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
      }
    },
    [pan]
  )

  const handleTouchMove = useCallback(
    (e: Event) => {
      const te = e as TouchEvent
      if (te.touches.length === 2 && pinchRef.current !== null) {
        e.preventDefault()
        const dx = te.touches[0].clientX - te.touches[1].clientX
        const dy = te.touches[0].clientY - te.touches[1].clientY
        const newDist = Math.sqrt(dx * dx + dy * dy)
        setZoom(prev => Math.min(Math.max(prev * (newDist / pinchRef.current!), 0.25), 5))
        pinchRef.current = newDist
        return
      }
      if (te.touches.length === 1 && isDragging) {
        e.preventDefault()
        const touch = te.touches[0]
        setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y })
      }
    },
    [isDragging, dragStart]
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    pinchRef.current = null
  }, [])

  // Selected-page thumbnails only stand in for the preview when there is no usable
  // inline document — i.e. several images merged into one PDF. For a real PDF we keep
  // the full, zoomable iframe; the low-res 300px thumbnails were unreadable and had
  // replaced the usable document preview.
  const showSelectedThumbs = !!selectedPageThumbs?.length && previewType !== 'pdf'
  const selectedPdfPages =
    previewType === 'pdf' && selectedPageThumbs?.length
      ? selectedPageThumbs.map(t => t.pageNum).join(', ')
      : null

  useEffect(() => {
    const el = frameRef.current
    if (!el || previewType !== 'image' || showSelectedThumbs) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    previewType,
    showSelectedThumbs,
  ])

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const onMouseUp = () => setIsDragging(false)

  const zoomIn = () => setZoom(p => Math.min(p + 0.25, 5))
  const zoomOut = () => setZoom(p => Math.max(p - 0.25, 0.25))
  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  const rotateCW = () => setRotate(r => (r + 90) % 360)
  const openNewTab = () => {
    if (!previewUrl) return
    window.open(previewType === 'pdf' ? previewUrl.split('#')[0] : previewUrl, '_blank')
  }

  const isImage = previewType === 'image'
  const isPdf = previewType === 'pdf'
  const hasToolbar = !showSelectedThumbs && (isImage || isPdf)
  const imageActive = isImage && !showSelectedThumbs
  const cursor = imageActive ? (isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in') : 'default'

  return (
    <div className="preview-column">
      <h2 className="section-title">
        <Eye size={16} /> Document Preview
      </h2>

      {hasToolbar && (
        <div className="preview-toolbar">
          {isImage && (
            <>
              <div className="prev-tool-group">
                <button
                  type="button"
                  className="prev-tool-btn"
                  onClick={zoomOut}
                  disabled={zoom <= 0.25}
                  title="Zoom out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="prev-zoom-pct">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className="prev-tool-btn"
                  onClick={zoomIn}
                  disabled={zoom >= 5}
                  title="Zoom in"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
              <div className="prev-tool-sep" />
              <button type="button" className="prev-tool-btn" onClick={resetView} title="Reset">
                <Minimize2 size={14} />
              </button>
              <button type="button" className="prev-tool-btn" onClick={rotateCW} title="Rotate 90°">
                <RotateCw size={14} />
              </button>
              <div className="prev-tool-sep" />
            </>
          )}
          {isPdf && !showSelectedThumbs && (
            <>
              <span className="prev-pdf-badge">
                <FileText size={14} /> PDF
              </span>
              <span className="prev-tool-hint">
                {selectedPdfPages
                  ? `Extracting page${selectedPageThumbs!.length > 1 ? 's' : ''} ${selectedPdfPages}`
                  : 'Scroll and zoom within the document'}
              </span>
              <div className="prev-tool-sep" />
            </>
          )}
          <button
            type="button"
            className="prev-tool-btn"
            onClick={openNewTab}
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      )}

      <div
        ref={frameRef}
        className={`preview-frame${hasToolbar ? ' preview-frame--docked' : ''}`}
        onMouseDown={imageActive ? onMouseDown : undefined}
        onMouseMove={imageActive ? onMouseMove : undefined}
        onMouseUp={imageActive ? onMouseUp : undefined}
        onMouseLeave={imageActive ? onMouseUp : undefined}
        style={{ cursor }}
      >
        {imageActive && previewUrl && (
          <div className="prev-img-wrap">
            <img
              src={previewUrl}
              alt="Document Preview"
              className="prev-img"
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotate}deg)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
              }}
            />
          </div>
        )}
        {isPdf && previewUrl && !showSelectedThumbs && (
          <iframe src={previewUrl} title="PDF Preview" className="preview-pdf-iframe" />
        )}
        {showSelectedThumbs && (
          <div className="prev-page-thumbs">
            {selectedPageThumbs!.map(({ thumb, pageNum, label }) => (
              <div key={pageNum} className="prev-page-thumb-item">
                <img
                  src={thumb}
                  alt={`Page ${pageNum}`}
                  className="prev-page-thumb-img"
                  draggable={false}
                />
                <div className="prev-page-thumb-label">{label ?? `Page ${pageNum}`}</div>
              </div>
            ))}
          </div>
        )}
        {!previewType && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap">
              <FileImage size={32} />
            </div>
            <p>
              No Preview File
              <br />
              <span style={{ fontSize: '.75rem', opacity: 0.5 }}>Preview will appear here</span>
            </p>
          </div>
        )}
        {previewType && !isImage && !isPdf && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap">
              <FileText size={32} />
            </div>
            <p>
              {previewType} File
              <br />
              <span style={{ fontSize: '.75rem', opacity: 0.5 }}>
                Preview not supported for this type
              </span>
            </p>
          </div>
        )}
      </div>

      {fileName && (
        <div className="file-info-strip" style={{ display: 'flex' }}>
          {isPdf ? <FileText size={14} /> : <File size={14} />}
          <span className="file-name">{fileName}</span>
          {hasToolbar && (
            <button
              type="button"
              className="btn-zoom-action"
              onClick={openNewTab}
              title="Open in new tab"
            >
              <ExternalLink size={14} /> Open in new tab
            </button>
          )}
        </div>
      )}
    </div>
  )
}

import type React from 'react'
