import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download } from 'lucide-react'
import { formatThb } from '../../lib/money'
import promptpayMark from '../../assets/logo.png'
import type { QrPayload } from '../../lib/api/credits'

/**
 * Renders a PromptPay dynamic-QR payload as a scannable code, with the amount
 * and destination shown in mono so the user can verify before paying.
 */
export default function PromptPayQR({ qr }: { qr: QrPayload }) {
  const holderRef = useRef<HTMLDivElement>(null)

  const handleDownload = () => {
    const svg = holderRef.current?.querySelector('svg')
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      const scale = 3
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const a = document.createElement('a')
        a.href = canvas.toDataURL('image/png')
        a.download = `promptpay-${qr.amount_thb}.png`
        a.click()
      }
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <div className="pp-qr">
      <div className="pp-qr-frame" ref={holderRef}>
        <QRCodeSVG
          value={qr.payload}
          size={208}
          level="M"
          marginSize={2}
          imageSettings={{ src: promptpayMark, height: 38, width: 38, excavate: true }}
        />
      </div>
      <div className="pp-qr-meta">
        <span className="pp-qr-amount text-mono">฿{formatThb(qr.amount_thb, true)}</span>
        <span className="pp-qr-dest">
          PromptPay <span className="text-mono">{qr.promptpay_id}</span>
        </span>
      </div>
      <button type="button" className="btn btn-outline pp-qr-save" onClick={handleDownload}>
        <Download size={14} /> Save QR
      </button>
    </div>
  )
}
