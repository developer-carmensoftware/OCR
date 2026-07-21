import { useRef, useState } from 'react'

import { ExternalLink, Maximize2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'

export function slipIsPdf(url: string): boolean {
  return /\.pdf$/i.test(url.split('?')[0])
}

export function SlipSkeleton() {
  return (
    <div className="orev-slip-sk" aria-hidden="true">
      <div className="orev-slip-sk-tools">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="skeleton orev-slip-sk-tool" />
        ))}
        <span className="skeleton orev-slip-sk-zoom" />
      </div>
      <div className="skeleton orev-slip-sk-stage" />
    </div>
  )
}

/** Slip viewer: zoom / pan / rotate for images; native iframe for PDFs. */
export function SlipViewer({ url, error }: { url: string | null; error: boolean }) {
  const { t } = useT()
  const [scale, setScale] = useState(1)
  const [rot, setRot] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  const reset = () => {
    setScale(1)
    setRot(0)
    setPan({ x: 0, y: 0 })
  }

  if (!url) {
    if (error) return <div className="orev-slip-fallback">{t('orev.slip.errFallback')}</div>
    return <SlipSkeleton />
  }

  if (slipIsPdf(url)) {
    return (
      <div className="orev-slip">
        {/* ponytail: no sandbox — Edge/Chrome block their built-in PDF viewer inside a
            sandboxed iframe. src is a short-lived FileService presigned URL to our own
            slip, not arbitrary HTML. Do not re-add sandbox (reintroduces the blocked-PDF bug). */}
        <iframe src={url} className="orev-slip-frame" title={t('orev.slip.heading')} />
        <a className="orev-slip-link" href={url} target="_blank" rel="noreferrer">
          <ExternalLink size={13} /> {t('orev.slip.openTab')}
        </a>
      </div>
    )
  }

  return (
    <div className="orev-slip">
      <div className="orev-slip-tools">
        <button
          type="button"
          className="orev-tool"
          onClick={() => setScale(s => Math.min(s + 0.25, 4))}
          aria-label={t('orev.slip.zoomIn')}
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          className="orev-tool"
          onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
          aria-label={t('orev.slip.zoomOut')}
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="orev-tool"
          onClick={() => setRot(r => (r + 90) % 360)}
          aria-label={t('orev.slip.rotate')}
        >
          <RotateCw size={15} />
        </button>
        <button
          type="button"
          className="orev-tool"
          onClick={reset}
          aria-label={t('orev.slip.reset')}
        >
          <Maximize2 size={15} />
        </button>
        <span className="orev-slip-zoom">{Math.round(scale * 100)}%</span>
      </div>
      <div
        className="orev-slip-stage"
        onPointerDown={e => {
          drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          if (!drag.current) return
          setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
        }}
        onPointerUp={() => (drag.current = null)}
        style={{ cursor: scale > 1 ? 'grab' : 'default' }}
      >
        <img
          src={url}
          alt={t('orev.slip.heading')}
          className="orev-slip-img"
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rot}deg)`,
          }}
        />
      </div>
    </div>
  )
}
