import { CheckCircle2, ExternalLink, RotateCw } from 'lucide-react'
import { fmt } from '../../constants/apInvoice'
import { getCarmenUrl } from '../../lib/url'
import { useT } from '../../i18n/LanguageContext'
import type { APInvoiceHeader } from '../../constants/apInvoice'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'

interface Props {
  headerData: APInvoiceHeader
  lineItems: APLineItem[]
  invoiceSeq: string | null
  onReset: () => void
}

export default function APSuccessStep({ headerData, lineItems, invoiceSeq, onReset }: Props) {
  const { t } = useT()
  const SUMMARY_ROWS = [
    { label: t('ap.subTotal'), val: fmt(headerData.subTotal) },
    { label: t('ap.discount'), val: fmt(headerData.totalDiscount), color: 'var(--rose)' as const },
    { label: t('ap.tax'), val: fmt(headerData.taxAmount) },
  ]

  return (
    <div className="ap-success-step-wrap">
      <div className="ap-success-wrap">
        <div className="ap-success-icon">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="ap-success-title">{t('ap.successTitle')}</h2>
        <p className="ap-success-subtitle">
          {t('ap.successDesc')}{' '}
          <span className="ap-success-doc-no">{headerData.documentNumber}</span>{' '}
          {t('ap.successDesc2')}
        </p>

        <div className="ap-success-grid">
          <div>
            <div className="ap-success-field-label">{t('ap.vendorName')}</div>
            <div className="ap-success-field-val">{headerData.vendorName || '—'}</div>
          </div>
          <div>
            <div className="ap-success-field-label">{t('ap.docDate')}</div>
            <div className="ap-success-field-val">{headerData.documentDate || '—'}</div>
          </div>
          <div>
            <div className="ap-success-field-label">{t('ap.itemCount')}</div>
            <div className="ap-success-field-val ap-success-val-highlight">
              {lineItems.length} {t('ap.items')}
            </div>
          </div>
          <div className="ap-success-summary-box">
            {SUMMARY_ROWS.map(({ label, val, color }) => (
              <div key={label} className="ap-success-summary-row">
                <span className="ap-success-summary-label">{label}:</span>
                <span
                  className={`ap-success-summary-val ${color === 'var(--rose)' ? 'color-rose' : ''}`}
                >
                  {val}
                </span>
              </div>
            ))}
            <div className="ap-success-summary-divider" />
            <div className="ap-success-total-row">
              <span className="ap-success-total-label">{t('ap.grandTotal')}</span>
              <span className="ap-success-total-val">{fmt(headerData.grandTotal)}</span>
            </div>
          </div>
        </div>

        <p className="ap-success-next-hint">{t('ap.readyAnother')}</p>
        <div className="ap-success-actions">
          {invoiceSeq && (
            <a
              href={getCarmenUrl(`/apInvoice/${invoiceSeq}/show`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              <ExternalLink size={14} /> {t('ap.viewApInvoice')}
            </a>
          )}
          <button type="button" className="btn btn-primary" onClick={onReset}>
            <RotateCw size={14} /> {t('ap.uploadNew')}
          </button>
        </div>
      </div>
    </div>
  )
}
