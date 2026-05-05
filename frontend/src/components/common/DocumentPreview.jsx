import { useState, useRef, useEffect, useCallback } from 'react'
import { Eye, ZoomIn, ZoomOut, Minimize2, RotateCw, FileText, ExternalLink, FileImage, File } from 'lucide-react'

export default function DocumentPreview({ previewUrl, previewType, fileName }) {
  const [zoom, setZoom] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const frameRef = useRef(null)
  const pinchRef = useRef(null) // stores last pinch distance

  // Reset on new file
  useEffect(() => {
    setZoom(1)
    setRotate(0)
    setPan({ x: 0, y: 0 })
  }, [previewUrl])

  // Scroll-to-zoom (image only, non-passive so preventDefault works)
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setZoom(prev => Math.min(Math.max(prev + delta, 0.25), 5))
  }, [])

  // Touch handlers (non-passive, attached via useEffect)
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = Math.sqrt(dx * dx + dy * dy)
      return
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart(prev => ({ x: touch.clientX - prev.x, y: touch.clientY - prev.y }))
      // store actual start relative to current pan
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
    }
  }, [pan])

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current !== null) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const newDist = Math.sqrt(dx * dx + dy * dy)
      const ratio = newDist / pinchRef.current
      setZoom(prev => Math.min(Math.max(prev * ratio, 0.25), 5))
      pinchRef.current = newDist
      return
    }
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault()
      const touch = e.touches[0]
      setPan(prev => {
        // dragStart is captured in closure — use ref instead
        return { x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y }
      })
    }
  }, [isDragging, dragStart])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    pinchRef.current = null
  }, [])

  useEffect(() => {
    const el = frameRef.current
    if (!el || previewType !== 'image') return
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
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, previewType])

  // Mouse drag-to-pan
  const onMouseDown = (e) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const onMouseMove = (e) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const onMouseUp = () => setIsDragging(false)

  const zoomIn    = () => setZoom(p => Math.min(p + 0.25, 5))
  const zoomOut   = () => setZoom(p => Math.max(p - 0.25, 0.25))
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const rotateCW  = () => setRotate(r => (r + 90) % 360)

  const openNewTab = () => {
    if (!previewUrl) return
    window.open(previewType === 'pdf' ? previewUrl.split('#')[0] : previewUrl, '_blank')
  }

  const isImage = previewType === 'image'
  const isPdf   = previewType === 'pdf'
  const hasToolbar = isImage || isPdf
  const cursor  = isImage ? (isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in') : 'default'

  return (
    <div className="preview-column">
      <h2 className="section-title">
        <Eye size={16} /> Document Preview
      </h2>

      {/* Toolbar */}
      {hasToolbar && (
        <div className="preview-toolbar">
          {isImage && (
            <>
              <div className="prev-tool-group">
                <button className="prev-tool-btn" onClick={zoomOut} disabled={zoom <= 0.25} title="ย่อ">
                  <ZoomOut size={14} />
                </button>
                <span className="prev-zoom-pct">{Math.round(zoom * 100)}%</span>
                <button className="prev-tool-btn" onClick={zoomIn} disabled={zoom >= 5} title="ขยาย">
                  <ZoomIn size={14} />
                </button>
              </div>
              <div className="prev-tool-sep" />
              <button className="prev-tool-btn" onClick={resetView} title="Reset">
                <Minimize2 size={14} />
              </button>
              <button className="prev-tool-btn" onClick={rotateCW} title="หมุน 90°">
                <RotateCw size={14} />
              </button>
              <div className="prev-tool-sep" />
            </>
          )}

          {isPdf && (
            <>
              <span className="prev-pdf-badge"><FileText size={14} /> PDF</span>
              <span className="prev-tool-hint">เลื่อนดูและซูมได้ในเอกสาร</span>
              <div className="prev-tool-sep" />
            </>
          )}

          <button className="prev-tool-btn" onClick={openNewTab} title="เปิดในแท็บใหม่">
            <ExternalLink size={14} />
          </button>
        </div>
      )}

      {/* Preview frame */}
      <div
        ref={frameRef}
        className={`preview-frame${hasToolbar ? ' preview-frame--docked' : ''}`}
        onMouseDown={isImage ? onMouseDown : undefined}
        onMouseMove={isImage ? onMouseMove : undefined}
        onMouseUp={isImage ? onMouseUp : undefined}
        onMouseLeave={isImage ? onMouseUp : undefined}
        style={{ cursor }}
      >
        {isImage && (
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

        {isPdf && (
          <iframe
            src={previewUrl}
            title="PDF Preview"
            className="preview-pdf-iframe"
          />
        )}

        {!previewType && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap"><FileImage size={32} /></div>
            <p>ยังไม่มีไฟล์ Preview<br /><span style={{ fontSize: '.75rem', opacity: .5 }}>Preview จะแสดงที่นี่</span></p>
          </div>
        )}

        {previewType && !isImage && !isPdf && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap"><FileText size={32} /></div>
            <p>{previewType} File<br /><span style={{ fontSize: '.75rem', opacity: .5 }}>Preview ไม่รองรับประเภทนี้</span></p>
          </div>
        )}
      </div>

      {/* File strip */}
      {fileName && (
        <div className="file-info-strip" style={{ display: 'flex' }}>
          {isPdf ? <FileText size={14} /> : <File size={14} />}
          <span className="file-name">{fileName}</span>
          {hasToolbar && (
            <button className="btn-zoom-action" onClick={openNewTab} title="เปิดในแท็บใหม่">
              <ExternalLink size={14} /> เปิดในแท็บใหม่
            </button>
          )}
        </div>
      )}
    </div>
  )
}
