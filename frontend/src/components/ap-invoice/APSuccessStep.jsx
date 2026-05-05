import { CheckCircle2, ExternalLink, RotateCw } from 'lucide-react'
import { fmt } from '../../constants/apInvoice'
import { getCarmenUrl } from '../../lib/url'

export default function APSuccessStep({ t, headerData, lineItems, invoiceSeq, onReset }) {
  const SUMMARY_ROWS = [
    { label: t.subTotal, val: fmt(headerData.subTotal) },
    { label: t.discount, val: fmt(headerData.totalDiscount), color: 'var(--rose)' },
    { label: t.tax,      val: fmt(headerData.taxAmount) },
  ]

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="ap-success-wrap">
        <div className="ap-success-icon">
          <CheckCircle2 size={48} />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.75rem' }}>
          {t.successTitle}
        </h2>
        <p style={{ color: 'var(--text-3)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {t.successDesc} <span className="ap-success-doc-no">{headerData.documentNumber}</span> {t.successDesc2}
        </p>

        <div className="ap-success-grid">
          <div>
            <div className="ap-success-field-label">{t.vendorName}</div>
            <div className="ap-success-field-val">{headerData.vendorName || '—'}</div>
          </div>
          <div>
            <div className="ap-success-field-label">{t.docDate}</div>
            <div className="ap-success-field-val">{headerData.documentDate || '—'}</div>
          </div>
          <div>
            <div className="ap-success-field-label">{t.itemCount}</div>
            <div className="ap-success-field-val" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              {lineItems.length} {t.items}
            </div>
          </div>
          <div style={{ gridRow: 'span 2', background: 'var(--ap-summary-bg, white)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
            {SUMMARY_ROWS.map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-3)' }}>{label}:</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: color || 'var(--text)' }}>{val}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '0.6rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800 }}>{t.grandTotal}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 800, color: 'var(--emerald)', fontSize: '1.05rem' }}>
                {fmt(headerData.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {invoiceSeq && (
            <a
              href={getCarmenUrl(`/apInvoice/${invoiceSeq}/show`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              <ExternalLink size={14} /> เปิดดู AP Invoice
            </a>
          )}
          <button className="btn btn-primary" onClick={onReset}>
            <RotateCw size={14} /> {t.uploadNew}
          </button>
        </div>
      </div>
    </div>
  )
}
