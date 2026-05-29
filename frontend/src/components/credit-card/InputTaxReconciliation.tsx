import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import {
  FileText,
  Scale,
  Flag,
  AlertCircle,
  X,
  Check,
  Loader2,
  ArrowLeft,
  PlusCircle,
} from 'lucide-react'
import { submitInputTax } from '../../lib/api/carmen'
import { normalizeYearToCE } from '../../lib/date'
import { toNum, fmt } from '../../lib/format'
import { useAccountingConfig } from '../../hooks/credit-card'
import type { DetailRow } from './DetailTable'

interface Props {
  details: DetailRow[]
  headerData: Record<string, string>
  onBack: () => void
  onFinish: () => void
}

export default function InputTaxReconciliation({
  details,
  headerData,
  onBack: _onBack,
  onFinish,
}: Props) {
  const { config } = useAccountingConfig()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const company = (config?.company ?? {}) as Record<string, string>
  const netAmount = details.reduce((s, d) => s + toNum(d.CommisAmt), 0)
  const taxAmount = details.reduce((s, d) => s + toNum(d.TaxAmt), 0)
  const total = netAmount + taxAmount
  const taxRate = netAmount > 0 ? parseFloat(((taxAmount / netAmount) * 100).toFixed(2)) : 7.0
  const taxProfile = `VAT0${Math.round(taxRate)} : VAT ${Math.round(taxRate)}%`

  const taxPeriod = (() => {
    if (!headerData.DocDate) return ''
    const parts = headerData.DocDate.split('/')
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : ''
  })()

  const description = (config as Record<string, unknown>)?.description
    ? `${(config as Record<string, unknown>).description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
    : ''

  const hasData = netAmount > 0 || taxAmount > 0

  async function handleAddInputTax() {
    setSubmitting(true)
    setSubmitError(null)
    const [mm, yyyy] = (taxPeriod || '/').split('/')
    const normalizedYYYY = normalizeYearToCE(yyyy)
    const prefix = `vat${normalizedYYYY}${mm}`
    const frDate = `${normalizedYYYY}-${mm}-01`
    const lastDay = new Date(Number(normalizedYYYY), Number(mm), 0).getDate()
    const toDate = `${normalizedYYYY}-${mm}-${String(lastDay).padStart(2, '0')}`

    let invhTInvDt = ''
    if (headerData.DocDate) {
      const [dd, mo, yy] = headerData.DocDate.split('/')
      invhTInvDt = `${normalizeYearToCE(yy)}-${mo}-${dd}T00:00:00.000Z`
    }

    const rateInt = Math.round(taxRate)
    const payload = {
      Prefix: prefix,
      Source: 'ACTX',
      FrDate: frDate,
      ToDate: toDate,
      InvhTInvNo: headerData.DocNo || '',
      InvhTInvDt: invhTInvDt,
      InvhDesc: description || '',
      VnName: company.name || '',
      TaxProfileCode: `VAT0${rateInt}`,
      BfTaxAmt: String(netAmount),
      TaxRate: taxRate,
      TaxAmt: taxAmount,
      TotalAmt: String(total),
      TaxId: company.taxId || '',
      BranchNo: company.branch || '',
      Address: company.address || '',
      UserModified: 'admin',
      TaxProfileDesc: `VAT ${rateInt}%`,
      VnCode: '',
    }

    try {
      await submitInputTax(payload)
      setShowConfirm(false)
      toast.success('Input Tax Reconciliation added successfully')
      onFinish()
    } catch (err) {
      const msg = (err as Error).message || 'An error occurred'
      setSubmitError(msg)
      toast.error(`Failed to add Input Tax: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="section-header">
        <span className="cc-step-title">
          <FileText size={16} /> Step 6: Input Tax Reconciliation
        </span>
      </div>

      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left">
            <Scale size={16} /> Input Tax Reconciliation
          </div>
          <div className="card-title-badges">
            <span className="cc-badge-primary">Source: ACTX</span>
            {taxPeriod && <span className="cc-badge-gray">Tax Period: {taxPeriod}</span>}
          </div>
        </div>

        <div className="card-body-flush">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr className="cc-table-header-row">
                  {[
                    'Source',
                    'Tax Invoice No.',
                    'Tax Invoice Date',
                    'Vendor Name',
                    'TAX ID.',
                    'Branch No.',
                    'Description',
                    'Tax Profile',
                  ].map(h => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                  {['Tax Rate %', 'Net Amount', 'Tax', 'Total'].map(h => (
                    <th key={h} scope="col" className="text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!hasData ? (
                  <tr>
                    <td colSpan={12} className="cc-empty-row-text">
                      No Credit card commission / Input Tax data available
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td>
                      <span className="cc-badge-teal-bold">ACTX</span>
                    </td>
                    <td className="cc-mono-text">{headerData.DocNo || '—'}</td>
                    <td>{headerData.DocDate || '—'}</td>
                    <td className="cc-max-w-160-wrap">{company.name || '—'}</td>
                    <td className="cc-mono-text">{company.taxId || '—'}</td>
                    <td>{company.branch || '—'}</td>
                    <td className="cc-desc-cell">{description || '—'}</td>
                    <td>
                      <span className="cc-badge-primary-nowrap">{taxProfile}</span>
                    </td>
                    <td className="text-right cc-mono-only">{fmt(taxRate)}</td>
                    <td className="text-right cc-mono-semi-bold">{fmt(netAmount)}</td>
                    <td className="text-right cc-mono-semi-bold">{fmt(taxAmount)}</td>
                    <td className="text-right cc-mono-bold-teal">{fmt(total)}</td>
                  </tr>
                )}
              </tbody>
              {hasData && (
                <tfoot>
                  <tr className="jv-total-row">
                    <td colSpan={9} className="text-right cc-font-bold">
                      TOTAL:
                    </td>
                    <td className="text-right cc-mono-bold">{fmt(netAmount)}</td>
                    <td className="text-right cc-mono-bold">{fmt(taxAmount)}</td>
                    <td className="text-right cc-mono-bold">{fmt(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-danger" onClick={() => setShowDiscardConfirm(true)}>
            <X size={14} /> Discard
          </button>
          <div className="form-actions-sep" />
          <button
            type="button"
            className="btn-submit"
            onClick={() => {
              setSubmitError(null)
              setShowConfirm(true)
            }}
            disabled={!hasData}
          >
            <PlusCircle size={14} /> Add Input Tax
          </button>
        </div>
      </div>

      {showConfirm &&
        createPortal(
          <div className="cc-modal-overlay-container">
            <div className="modal-box">
              <div className="cc-modal-icon-teal">
                <FileText size={36} />
              </div>
              <div className="cc-modal-title">Add Input Tax Reconciliation</div>
              <p className="cc-modal-body-text">
                This item will be automatically added to the system as an
                <br />
                <strong>Input Tax Reconciliation</strong>.<br />
                Do you want to proceed?
              </p>
              <div className="cc-modal-info-box-teal">
                <Flag size={14} className="cc-info-icon-flag" />
                <span>
                  After confirmation, the system will <strong>complete the entire process</strong>{' '}
                  and return to the start page automatically.
                </span>
              </div>
              {submitError && (
                <div className="cc-modal-error-box">
                  <AlertCircle size={14} className="cc-error-icon-alert" /> {submitError}
                </div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={handleAddInputTax}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showDiscardConfirm &&
        createPortal(
          <div className="cc-modal-overlay-container">
            <div className="modal-box">
              <div className="cc-modal-icon-rose">
                <Flag size={36} />
              </div>
              <div className="cc-modal-title">Skip Input Tax step?</div>
              <p className="cc-modal-body-text">
                You chose <strong>not to add Input Tax</strong> to the system.
              </p>
              <div className="cc-modal-info-box-rose">
                <Flag size={14} className="cc-info-icon-flag" />
                <span>
                  This action will <strong>complete the entire process</strong> and return to the
                  start page.
                </span>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  <ArrowLeft size={14} /> Back to review
                </button>
                <button
                  type="button"
                  className="btn-danger cc-btn-danger-rose"
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
