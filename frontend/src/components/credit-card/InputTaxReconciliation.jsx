import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { FileText, Scale, Flag, AlertCircle, X, Check, Loader2, ArrowLeft, PlusCircle } from 'lucide-react'
import { submitInputTax } from '../../lib/api/carmen'
import { normalizeYearToCE } from '../../lib/date'


function toNum(v) {
  return parseFloat(String(v ?? '').replace(/,/g, '')) || 0
}

const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function InputTaxReconciliation({ details, headerData, onBack, onFinish }) {
  const [config, setConfig] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('accountingConfig')
      if (raw) setConfig(JSON.parse(raw))
    } catch (e) {}
  }, [])

  const company = config?.company || {}

  const netAmount = details.reduce((s, d) => s + toNum(d.CommisAmt ?? d.commis_amt), 0)
  const taxAmount = details.reduce((s, d) => s + toNum(d.TaxAmt   ?? d.tax_amt), 0)
  const total     = netAmount + taxAmount
  const taxRate   = netAmount > 0 ? parseFloat(((taxAmount / netAmount) * 100).toFixed(2)) : 7.00
  const taxProfile = `VAT0${Math.round(taxRate)} : VAT ${Math.round(taxRate)}%`

  // Tax period: DD/MM/YYYY → MM/YYYY
  const taxPeriod = (() => {
    if (!headerData.DocDate) return ''
    const parts = headerData.DocDate.split('/')
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : ''
  })()

  const description = config?.description
    ? `${config.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
    : ''

  const hasData = netAmount > 0 || taxAmount > 0

  async function handleAddInputTax() {
    setSubmitting(true)
    setSubmitError(null)

    // taxPeriod: "MM/YYYY" → derive prefix, FrDate, ToDate
    const [mm, yyyy] = (taxPeriod || '/').split('/')
    const normalizedYYYY = normalizeYearToCE(yyyy)
    const prefix   = `vat${normalizedYYYY}${mm}`
    const frDate   = `${normalizedYYYY}-${mm}-01`
    const lastDay  = new Date(Number(normalizedYYYY), Number(mm), 0).getDate()
    const toDate   = `${normalizedYYYY}-${mm}-${String(lastDay).padStart(2, '0')}`

    // DocDate: "DD/MM/YYYY" → "YYYY-MM-DDT00:00:00.000Z"
    let invhTInvDt = ''
    if (headerData.DocDate) {
      const [dd, mo, yy] = headerData.DocDate.split('/')
      const normalizedYY = normalizeYearToCE(yy)
      invhTInvDt = `${normalizedYY}-${mo}-${dd}T00:00:00.000Z`
    }

    const rateInt = Math.round(taxRate)

    const payload = {
      Prefix:         prefix,
      Source:         'OCC',
      FrDate:         frDate,
      ToDate:         toDate,
      InvhTInvNo:     headerData.DocNo || '',
      InvhTInvDt:     invhTInvDt,
      InvhDesc:       description || '',
      VnName:         company.name || '',
      TaxProfileCode: `VAT0${rateInt}`,
      BfTaxAmt:       String(netAmount),
      TaxRate:        taxRate,
      TaxAmt:         taxAmount,
      TotalAmt:       String(total),
      TaxId:          company.taxId || '',
      BranchNo:       company.branch || '',
      Address:        company.address || '',
      UserModified:   'admin',
      TaxProfileDesc: `VAT ${rateInt}%`,
      VnCode:         '',
    }

    try {
      await submitInputTax(payload)
      setShowConfirm(false)
      toast.success('Input Tax Reconciliation added successfully')
      onFinish()
    } catch (err) {
      const msg = err.message || 'An error occurred'
      setSubmitError(msg)
      toast.error(`Failed to add Input Tax: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="section-header">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={16} /> Step 6: Input Tax Reconciliation</span>
      </div>

      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left">
            <Scale size={16} /> Input Tax Reconciliation
          </div>
          <div className="card-title-badges">
            <span style={{
              background: 'var(--primary-light)', color: 'var(--primary)',
              border: '1px solid var(--primary-mid)', borderRadius: '4px',
              padding: '0.2rem 0.65rem', fontSize: '0.8rem', fontWeight: 600,
            }}>
              Source: OCC
            </span>
            {taxPeriod && (
              <span style={{
                background: 'var(--gray-100)', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: '4px',
                padding: '0.2rem 0.65rem', fontSize: '0.8rem', fontWeight: 500,
              }}>
                Tax Period: {taxPeriod}
              </span>
            )}
          </div>
        </div>

        <div className="card-body-flush">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-table-header, #2b4d81)', color: 'var(--text-table-header, #fff)' }}>
                  <th style={{ color: 'inherit', background: 'inherit' }}>Source</th>
                  <th style={{ color: 'inherit', background: 'inherit' }}>Tax Invoice No.</th>
                  <th style={{ color: 'inherit', background: 'inherit' }}>Tax Invoice Date</th>
                  <th style={{ color: 'inherit', background: 'inherit' }}>Vendor Name</th>
                  <th style={{ color: 'inherit', background: 'inherit' }}>TAX ID.</th>
                  <th style={{ color: 'inherit', background: 'inherit' }}>Branch No.</th>
                  <th style={{ color: 'inherit', background: 'inherit' }}>Description</th>
                  <th style={{ color: 'inherit', background: 'inherit' }}>Tax Profile</th>
                  <th className="text-right" style={{ color: 'inherit', background: 'inherit' }}>Tax Rate %</th>
                  <th className="text-right" style={{ color: 'inherit', background: 'inherit' }}>Net Amount</th>
                  <th className="text-right" style={{ color: 'inherit', background: 'inherit' }}>Tax</th>
                  <th className="text-right" style={{ color: 'inherit', background: 'inherit' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {!hasData ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                      No Credit card commission / Input Tax data available
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td>
                      <span style={{
                        background: 'var(--teal-light)', color: 'var(--teal)',
                        border: '1px solid var(--btn-ok-border, #99f6e4)', borderRadius: '4px',
                        padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 700,
                      }}>
                        OCC
                      </span>
                    </td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.83rem' }}>
                      {headerData.DocNo || '—'}
                    </td>
                    <td>{headerData.DocDate || '—'}</td>
                    <td style={{ maxWidth: '160px', whiteSpace: 'normal' }}>{company.name || '—'}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.83rem' }}>
                      {company.taxId || '—'}
                    </td>
                    <td>{company.branch || '—'}</td>
                    <td style={{ maxWidth: '180px', whiteSpace: 'normal', color: 'var(--text-2)', fontSize: '0.83rem' }}>
                      {description || '—'}
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--primary-light)', color: 'var(--primary)',
                        border: '1px solid var(--primary-mid)', borderRadius: '4px',
                        padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {taxProfile}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {fmt(taxRate)}
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                      {fmt(netAmount)}
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                      {fmt(taxAmount)}
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--teal)' }}>
                      {fmt(total)}
                    </td>
                  </tr>
                )}
              </tbody>
              {hasData && (
                <tfoot>
                  <tr className="jv-total-row">
                    <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL:</td>
                    <td className="text-right" style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(netAmount)}</td>
                    <td className="text-right" style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(taxAmount)}</td>
                    <td className="text-right" style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-danger" onClick={() => setShowDiscardConfirm(true)}>
            <X size={14} /> Discard
          </button>
          <div className="form-actions-sep" />
          <button className="btn-submit" onClick={() => { setSubmitError(null); setShowConfirm(true) }} disabled={!hasData}>
            <PlusCircle size={14} /> Add Input Tax
          </button>
        </div>
      </div>

      {showConfirm && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--modal-overlay-bg, rgba(0,0,0,0.45))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div className="modal-box" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '0.75rem', color: 'var(--teal)', display: 'flex', justifyContent: 'center' }}>
              <FileText size={36} />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.65rem' }}>
              Add Input Tax Reconciliation
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.92rem', marginBottom: '1rem', lineHeight: 1.7 }}>
              This item will be automatically added to the system as an<br />
              <strong>Input Tax Reconciliation</strong>.<br />
              Do you want to proceed?
            </p>
            <div style={{
              background: 'var(--teal-light)', border: '1px solid var(--btn-ok-border, #99f6e4)', borderRadius: '6px',
              padding: '0.55rem 0.85rem', marginBottom: '1.25rem',
              color: 'var(--teal)', fontSize: '0.82rem', textAlign: 'left', display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
            }}>
              <Flag size={14} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
              <span>After confirmation, the system will <strong>complete the entire process</strong> and return to the start page automatically.</span>
            </div>
            {submitError && (
              <div style={{
                background: 'var(--btn-err-bg, #fef2f2)', border: '1px solid var(--btn-err-border, #fca5a5)', borderRadius: '6px',
                padding: '0.6rem 0.85rem', marginBottom: '1.25rem',
                color: 'var(--btn-err-text, #b91c1c)', fontSize: '0.85rem', textAlign: 'left',
              }}>
                <AlertCircle size={14} style={{ marginRight: '0.4rem', flexShrink: 0 }} />
                {submitError}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn-submit"
                onClick={handleAddInputTax}
                disabled={submitting}
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
                  : <><Check size={14} /> Confirm</>
                }
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDiscardConfirm && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--modal-overlay-bg, rgba(0,0,0,0.45))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div className="modal-box" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '0.75rem', color: 'var(--rose)', display: 'flex', justifyContent: 'center' }}>
              <Flag size={36} />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Skip Input Tax step?
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.92rem', marginBottom: '1rem', lineHeight: 1.7 }}>
              You chose <strong>not to add Input Tax</strong> to the system.
            </p>
            <div style={{
              background: 'var(--btn-err-bg, #fef2f2)', border: '1px solid var(--btn-err-border, #fca5a5)', borderRadius: '6px',
              padding: '0.55rem 0.85rem', marginBottom: '1.5rem',
              color: 'var(--btn-err-text, #b91c1c)', fontSize: '0.82rem', textAlign: 'left', display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
            }}>
              <Flag size={14} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
              <span>This action will <strong>complete the entire process</strong> and return to the start page.</span>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDiscardConfirm(false)}>
                <ArrowLeft size={14} /> Back to review
              </button>
              <button
                className="btn-danger"
                style={{ background: 'var(--rose)', color: 'white' }}
                onClick={() => {
                  setShowDiscardConfirm(false)
                  toast.info('Process completed without adding Input Tax')
                  onFinish()
                }}
              >
                <X size={14} /> Confirm Discard
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
