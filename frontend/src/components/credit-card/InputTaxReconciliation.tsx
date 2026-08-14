import { useState, useEffect } from 'react'
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
import { SkeletonRow } from '../common/Skeleton'
import { submitInputTax, fetchTaxProfiles } from '../../lib/api/carmen'
import type { TaxProfileItem } from '../../lib/api/carmen'
import { normalizeYearToCE } from '../../lib/date'
import { parseNum, fmt, round2 } from '../../lib/format'
import { useT } from '../../i18n/LanguageContext'
import { useAccountingConfig } from '../../hooks/credit-card'
import { resolveTaxProfileForRate } from '../../lib/apTax'
import { descriptionForBank } from '../../lib/bankTransforms'
import type { BankCode } from '../../types/api'
import type { DetailRow } from './DetailTable'

interface Props {
  details: DetailRow[]
  headerData: Record<string, string>
  bank?: BankCode | ''
  onBack: () => void
  onFinish: () => void
}

export default function InputTaxReconciliation({
  details,
  headerData,
  bank,
  onBack: _onBack,
  onFinish,
}: Props) {
  const { t } = useT()
  const { config, loading: configLoading } = useAccountingConfig()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [taxProfiles, setTaxProfiles] = useState<TaxProfileItem[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)

  useEffect(() => {
    setProfilesLoading(true)
    fetchTaxProfiles()
      .then(setTaxProfiles)
      .catch(() => {})
      .finally(() => setProfilesLoading(false))
  }, [])

  const company = (config?.company ?? {}) as Record<string, string>
  const netAmount = details.reduce((s, d) => s + parseNum(d.CommisAmt), 0)
  const taxAmount = details.reduce((s, d) => s + parseNum(d.TaxAmt), 0)
  const total = netAmount + taxAmount
  const taxRate = netAmount > 0 ? parseFloat(((taxAmount / netAmount) * 100).toFixed(2)) : 7.0
  const resolvedProfileCode = resolveTaxProfileForRate(taxRate, taxProfiles)
  const resolvedProfileItem = taxProfiles.find(p => p.code === resolvedProfileCode)
  const taxProfile = resolvedProfileItem
    ? `${resolvedProfileItem.code} : ${resolvedProfileItem.desc}`
    : `VAT0${Math.round(taxRate)} : VAT ${Math.round(taxRate)}%`
  // Display/charge the profile's canonical rate, not the raw ratio — slightly-off extracted
  // amounts (e.g. tax 70.10 / net 1000 = 7.01) must not contradict the "VAT 7%" badge.
  const displayRate = resolvedProfileItem?.rate ?? Math.round(taxRate)
  // We post the profile's canonical rate but keep the document's real VAT amount.
  // If base × rate disagrees with the extracted VAT, the document's effective rate
  // isn't standard — flag it so the user verifies before posting to ACTX.
  const effectiveRateOff =
    netAmount > 0 && Math.abs(round2(netAmount * (displayRate / 100)) - round2(taxAmount)) > 0.02

  const taxPeriod = (() => {
    if (!headerData.DocDate) return ''
    const parts = headerData.DocDate.split('/')
    return parts.length === 3 ? `${parts[1]}/${normalizeYearToCE(parts[2])}` : ''
  })()

  // Same resolution the JV uses (useOcrSubmission) and the same the email-ingest job
  // uses server-side — two documents from one statement must not disagree about what
  // they are.
  const resolvedDescription = descriptionForBank(
    config?.description,
    config?.bankDescriptions,
    bank
  )
  const description = resolvedDescription
    ? `${resolvedDescription}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
    : ''

  const hasData = netAmount > 0 || taxAmount > 0
  // Company / tax-profile cells are populated from the accounting config and the
  // tax-profile list — show a skeleton until both resolve instead of flashing "—".
  const isLoading = configLoading || profilesLoading

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

    const payload = {
      Prefix: prefix,
      Source: 'ACTX',
      FrDate: frDate,
      ToDate: toDate,
      InvhTInvNo: headerData.DocNo || '',
      InvhTInvDt: invhTInvDt,
      InvhDesc: description || '',
      VnName: company.name || '',
      TaxProfileCode: resolvedProfileCode || `VAT0${Math.round(taxRate)}`,
      BfTaxAmt: round2(netAmount).toFixed(2),
      TaxRate: displayRate,
      TaxAmt: round2(taxAmount),
      TotalAmt: round2(total).toFixed(2),
      TaxId: company.taxId || '',
      BranchNo: company.branch || '',
      Address: company.address || '',
      UserModified: 'admin',
      TaxProfileDesc: resolvedProfileItem?.desc ?? `VAT ${Math.round(taxRate)}%`,
      VnCode: '',
    }

    try {
      await submitInputTax(payload)
      setShowConfirm(false)
      toast.success(t('cc.inputTaxAdded'))
      onFinish()
    } catch (err) {
      const msg = (err as Error).message || 'An error occurred'
      setSubmitError(msg)
      toast.error(t('cc.inputTaxFailed', { msg }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="section-header">
        <span className="cc-step-title">
          <FileText size={16} /> {t('cc.step6Title')}
        </span>
      </div>

      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left">
            <Scale size={16} /> {t('cc.inputTaxRecon')}
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
                {isLoading ? (
                  <SkeletonRow cols={12} />
                ) : !hasData ? (
                  <tr>
                    <td colSpan={12} className="cc-empty-row-text">
                      {t('cc.noTaxData')}
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
                    <td className="text-right cc-mono-only">{fmt(displayRate)}</td>
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

        {hasData && effectiveRateOff && (
          <div className="mapping-alert is-danger">
            <AlertCircle size={16} />
            <span className="cc-alert-text">{t('cc.effectiveRateNote')}</span>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-danger" onClick={() => setShowDiscardConfirm(true)}>
            <X size={14} /> {t('cc.discard')}
          </button>
          <div className="form-actions-sep" />
          <button
            type="button"
            className="btn-submit"
            onClick={() => {
              setSubmitError(null)
              setShowConfirm(true)
            }}
            disabled={!hasData || isLoading}
          >
            <PlusCircle size={14} /> {t('cc.addInputTax')}
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
              <div className="cc-modal-title">{t('cc.addInputTaxTitle')}</div>
              <p className="cc-modal-body-text">{t('cc.addInputTaxBody')}</p>
              <div className="cc-modal-info-box-teal">
                <Flag size={14} className="cc-info-icon-flag" />
                <span>{t('cc.addInputTaxInfo')}</span>
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
                  {t('modal.cancel')}
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={handleAddInputTax}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> {t('cc.sending')}
                    </>
                  ) : (
                    <>
                      <Check size={14} /> {t('cc.confirm')}
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
              <div className="cc-modal-title">{t('cc.skipTitle')}</div>
              <p className="cc-modal-body-text">{t('cc.skipBody')}</p>
              <div className="cc-modal-info-box-rose">
                <Flag size={14} className="cc-info-icon-flag" />
                <span>{t('cc.skipInfo')}</span>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  <ArrowLeft size={14} /> {t('cc.backToReview')}
                </button>
                <button
                  type="button"
                  className="btn-danger cc-btn-danger-rose"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    toast.info(t('cc.processedNoTax'))
                    onFinish()
                  }}
                >
                  <X size={14} /> {t('cc.confirmDiscard')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
