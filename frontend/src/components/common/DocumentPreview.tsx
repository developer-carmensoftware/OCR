import { useEffect, useRef, useReducer, useCallback } from 'react'
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
import { useT } from '../../i18n/LanguageContext'

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

interface DocPreviewState {
  zoom: number
  rotate: number
  pan: { x: number; y: number }
  isDragging: boolean
  dragStart: { x: number; y: number }
}

type DocPreviewAction =
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'SET_ZOOM_VALUE'; payload: number | ((prev: number) => number) }
  | { type: 'ROTATE_CW' }
  | { type: 'RESET_VIEW' }
  | { type: 'START_DRAG'; payload: { startX: number; startY: number } }
  | { type: 'DRAG'; payload: { x: number; y: number } }
  | { type: 'END_DRAG' }

const initialDocPreviewState: DocPreviewState = {
  zoom: 1,
  rotate: 0,
  pan: { x: 0, y: 0 },
  isDragging: false,
  dragStart: { x: 0, y: 0 },
}

function docPreviewReducer(state: DocPreviewState, action: DocPreviewAction): DocPreviewState {
  switch (action.type) {
    case 'ZOOM_IN':
      return { ...state, zoom: Math.min(state.zoom + 0.25, 5) }
    case 'ZOOM_OUT':
      return { ...state, zoom: Math.max(state.zoom - 0.25, 0.25) }
    case 'SET_ZOOM_VALUE': {
      const nextZoom =
        typeof action.payload === 'function' ? action.payload(state.zoom) : action.payload
      return { ...state, zoom: nextZoom }
    }
    case 'ROTATE_CW':
      return { ...state, rotate: (state.rotate + 90) % 360 }
    case 'RESET_VIEW':
      return { ...state, zoom: 1, pan: { x: 0, y: 0 } }
    case 'START_DRAG':
      return {
        ...state,
        isDragging: true,
        dragStart: { x: action.payload.startX, y: action.payload.startY },
      }
    case 'DRAG':
      return {
        ...state,
        pan: { x: action.payload.x, y: action.payload.y },
      }
    case 'END_DRAG':
      return { ...state, isDragging: false }
    default:
      return state
  }
}

export default function DocumentPreview({
  previewUrl,
  previewType,
  fileName,
  selectedPageThumbs,
}: Props) {
  const [state, dispatch] = useReducer(docPreviewReducer, initialDocPreviewState)
  const { zoom, rotate, pan, isDragging, dragStart } = state
  const frameRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<number | null>(null)

  const handleWheel = useCallback((e: Event) => {
    const we = e as WheelEvent
    dispatch({
      type: 'SET_ZOOM_VALUE',
      payload: (prev: number) => Math.min(Math.max(prev + (we.deltaY > 0 ? -0.15 : 0.15), 0.25), 5),
    })
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
        dispatch({
          type: 'START_DRAG',
          payload: { startX: touch.clientX - pan.x, startY: touch.clientY - pan.y },
        })
      }
    },
    [pan]
  )

  const handleTouchMove = useCallback(
    (e: Event) => {
      const te = e as TouchEvent
      if (te.touches.length === 2 && pinchRef.current !== null) {
        const dx = te.touches[0].clientX - te.touches[1].clientX
        const dy = te.touches[0].clientY - te.touches[1].clientY
        const newDist = Math.sqrt(dx * dx + dy * dy)
        dispatch({
          type: 'SET_ZOOM_VALUE',
          payload: (prev: number) =>
            Math.min(Math.max(prev * (newDist / pinchRef.current!), 0.25), 5),
        })
        pinchRef.current = newDist
        return
      }
      if (te.touches.length === 1 && isDragging) {
        const touch = te.touches[0]
        dispatch({
          type: 'DRAG',
          payload: { x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y },
        })
      }
    },
    [isDragging, dragStart]
  )

  const handleTouchEnd = useCallback(() => {
    dispatch({ type: 'END_DRAG' })
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

  const handlersRef = useRef({ handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd })
  useEffect(() => {
    handlersRef.current = { handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd }
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd])

  useEffect(() => {
    const el = frameRef.current
    if (!el || previewType !== 'image' || showSelectedThumbs) return

    const onWheel = (e: Event) => handlersRef.current.handleWheel(e)
    const onTouchStart = (e: Event) => handlersRef.current.handleTouchStart(e)
    const onTouchMove = (e: Event) => handlersRef.current.handleTouchMove(e)
    const onTouchEnd = () => handlersRef.current.handleTouchEnd()

    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [previewType, showSelectedThumbs])

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    dispatch({
      type: 'START_DRAG',
      payload: { startX: e.clientX - pan.x, startY: e.clientY - pan.y },
    })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    dispatch({
      type: 'DRAG',
      payload: { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y },
    })
  }
  const onMouseUp = () => dispatch({ type: 'END_DRAG' })

  const zoomIn = () => dispatch({ type: 'ZOOM_IN' })
  const zoomOut = () => dispatch({ type: 'ZOOM_OUT' })
  const resetView = () => dispatch({ type: 'RESET_VIEW' })
  const rotateCW = () => dispatch({ type: 'ROTATE_CW' })
  const openNewTab = () => {
    if (!previewUrl) return
    window.open(previewType === 'pdf' ? previewUrl.split('#')[0] : previewUrl, '_blank')
  }

  const isImage = previewType === 'image'
  const isPdf = previewType === 'pdf'
  const hasToolbar = !showSelectedThumbs && (isImage || isPdf)
  const imageActive = isImage && !showSelectedThumbs
  const cursor = imageActive ? (isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in') : 'default'

  const { t } = useT()
  return (
    <div className="preview-column">
      <h2 className="section-title">
        <Eye size={16} /> {t('common.docPreview')}
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
                  ? t(
                      selectedPageThumbs!.length > 1
                        ? 'common.extractingPages'
                        : 'common.extractingPage',
                      { pages: selectedPdfPages }
                    )
                  : t('common.scrollZoom')}
              </span>
              <div className="prev-tool-sep" />
            </>
          )}
          <button
            type="button"
            className="prev-tool-btn"
            onClick={openNewTab}
            title={t('common.openNewTab')}
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
          // ponytail: no sandbox — Edge/Chrome block their built-in PDF viewer inside a
          // sandboxed iframe ("blocked by Microsoft Edge"). src is our own trusted PDF
          // (blob / short-lived signed URL), not arbitrary HTML, so sandbox adds no real
          // security here. Do not re-add sandbox (that reintroduces the blank/blocked bug).
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
              {t('common.noPreview')}
              <br />
              <span style={{ fontSize: '.75rem', opacity: 0.5 }}>{t('common.previewHint')}</span>
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
                {t('common.previewUnsupported')}
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
              title={t('common.openNewTab')}
            >
              <ExternalLink size={14} /> {t('common.openNewTab')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

import type React from 'react'
