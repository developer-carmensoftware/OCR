import { useState, useEffect } from 'react'
import {
  CheckCheck,
  AlertTriangle,
  Info,
  FileText,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Settings,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import { SkeletonRow } from '../common/Skeleton'
import CustomModal from '../common/CustomModal'
import Card from '../common/Card'
import Badge from '../common/Badge'
import { fetchAccountCodes } from '../../lib/api/carmen'
import { parseNum, fmt, round2 } from '../../lib/format'
import { useT } from '../../i18n/LanguageContext'
import { useAccountingConfig } from '../../hooks/credit-card'
import { buildJvRows } from '../../lib/ccJv'
import { GROUP_DEBIT_BY_TRANSACTION } from '../../constants/banks'
import { codeToSource, descriptionForBank } from '../../lib/bankTransforms'
import type { DetailRow } from './DetailTable'
import type { JvRow } from '../../hooks/credit-card/useOcrSubmission'
import type { BankCode } from '../../types/api'

interface Props {
  details: DetailRow[]
  headerData?: Record<string, string>
  bank?: BankCode | ''
  onBack: () => void
  onSubmit: (rows: JvRow[]) => void
  onGoMapping: () => void
  submitting?: boolean
}

let _accCache: Record<string, string> | null = null

const DEFAULT_EMPTY_OBJECT = {}

export default function AccountingReview({
  details,
  headerData = DEFAULT_EMPTY_OBJECT,
  bank = '',
  onBack,
  onSubmit,
  onGoMapping,
  submitting = false,
}: Props) {
  const { t } = useT()
  const { config, loading: configLoading, refresh: loadConfig } = useAccountingConfig()
  const [warningModal, setWarningModal] = useState(false)
  const [accNameMap, setAccNameMap] = useState<Record<string, string>>(_accCache || {})
  const [accLoading, setAccLoading] = useState(!_accCache)

  useEffect(() => {
    if (_accCache) return
    setAccLoading(true)
    fetchAccountCodes()
      .then(list => {
        const map: Record<string, string> = {}
        list.forEach(a => {
          if (a.AccCode) map[a.AccCode as string] = (a.Description as string) || ''
        })
        _accCache = map
        setAccNameMap(map)
      })
      .catch(() => {})
      .finally(() => setAccLoading(false))
  }, [])

  const getAccName = (acc: string) => accNameMap[acc] || ''
  const rawConfig = config as Record<string, unknown> | null
  const rows = rawConfig
    ? buildJvRows(details, rawConfig, {
        consolidateDebit: !GROUP_DEBIT_BY_TRANSACTION,
      })
    : []
  // Rows depend on BOTH the accounting config and the account-name map. Account
  // names are module-cached, so on repeat visits accLoading is already false
  // while the config is still loading — gate on both to avoid a "No data" flash.
  const isLoading = configLoading || accLoading
  const totalDr = rows.reduce((s, r) => s + r.debit, 0)
  const totalCr = rows.reduce((s, r) => s + r.credit, 0)

  // Every layout satisfies gross = commission + tax + net per row, so the JV's
  // Dr (Σ commission+tax+net) must equal its Cr (Σ gross). A mismatch means a
  // line is internally inconsistent — extraction drift, or a manual edit that
  // left the columns out of sync — and the JV would post unbalanced. Surface
  // the offending line(s) and block submit until it's fixed.
  const imbalancedLines = details
    .map((d, i) => ({
      line: i + 1,
      diff: round2(
        parseNum(d.PayAmt) - (parseNum(d.CommisAmt) + parseNum(d.TaxAmt) + parseNum(d.Total))
      ),
    }))
    .filter(r => Math.abs(r.diff) > 0.01)
  const isImbalanced = Math.abs(round2(totalDr) - round2(totalCr)) > 0.01

  const unmappedFields: string[] = []
  if (rawConfig) {
    if (!rawConfig.filePrefix) unmappedFields.push('File Prefix')
    const m = (rawConfig.mappings || {}) as Record<string, { acc?: string }>
    if (!m.commission?.acc) unmappedFields.push('Credit card commission')
    if (!m.tax?.acc) unmappedFields.push('Input Tax')
    // Some formats (e.g. fee invoices) always have Total=0, so the net row is
    // never posted — only demand the mapping when a row will use it.
    if (!m.net?.acc && details.some(d => parseNum(d.Total))) unmappedFields.push('Bank Account')
    const pa = (rawConfig.paymentAmount || {}) as Record<string, { acc?: string }>
    const detailTypes = [
      ...new Set(details.flatMap(d => (d.Transaction ? [d.Transaction] : []))),
    ] as string[]
    detailTypes.forEach(pt => {
      if (!pa[pt]?.acc) unmappedFields.push(pt)
    })
  }
  const hasMissing = !rawConfig || unmappedFields.length > 0

  const reviewDescription = descriptionForBank(
    rawConfig?.description as string | undefined,
    rawConfig?.bankDescriptions as Record<string, string> | undefined,
    bank
  )
  const configBadges = rawConfig
    ? [
        { label: `Prefix: ${rawConfig.filePrefix || '-'}`, variant: 'info' as const },
        {
          // Source is bank-derived (matches what will post), not the stored config value.
          label: `Source: ${(bank && codeToSource(bank)) || rawConfig.fileSource || '-'}`,
          variant: 'gray' as const,
        },
        {
          // Resolved per bank, exactly as the JV and the input-tax record do — this
          // badge is a preview of what will post, so reading the BU-wide value here
          // showed the old wording after a per-bank one had been saved.
          label: `Description: ${reviewDescription ? `${reviewDescription}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}` : '-'}`,
          variant: 'gray' as const,
        },
      ]
    : []

  return (
    <div>
      <div className="section-header">
        <span className="cc-step-title">
          <CheckCheck size={16} /> {t('cc.step4Title')}
        </span>
      </div>

      {!isLoading && hasMissing && rawConfig && (
        <div className="mapping-alert">
          <AlertTriangle size={16} />
          <span className="cc-alert-text">
            {t('cc.missingMappingFor')} <strong>{unmappedFields.join(', ')}</strong>
          </span>
          <button type="button" className="btn btn-sm btn-danger" onClick={onGoMapping}>
            {t('cc.editMapping')}
          </button>
        </div>
      )}
      {!isLoading && !rawConfig && (
        <div className="mapping-alert">
          <Info size={16} />
          <span className="cc-alert-text">{t('cc.noMapping')}</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={onGoMapping}>
            {t('cc.goMappingSettings')}
          </button>
        </div>
      )}
      {!isLoading && rows.length > 0 && isImbalanced && (
        <div className="mapping-alert is-danger">
          <AlertCircle size={16} />
          <span className="cc-alert-text">
            {t('cc.jvImbalance', {
              debit: fmt(totalDr),
              credit: fmt(totalCr),
              lines: imbalancedLines.map(r => r.line).join(', ') || '—',
            })}
          </span>
          <button type="button" className="btn btn-sm btn-danger" onClick={onBack}>
            {t('cc.back')}
          </button>
        </div>
      )}

      <Card
        icon={<FileText size={16} />}
        title={
          <>
            {t('cc.journalDetails')}
            {accLoading && (
              <span className="cc-loader-text">
                <Loader2 size={12} className="animate-spin" /> {t('cc.loadingAccNames')}
              </span>
            )}
          </>
        }
        right={
          <div className="card-title-badges">
            {configBadges.map(({ label, variant }) => (
              <Badge key={label} variant={variant} pill={false}>
                {label}
              </Badge>
            ))}
          </div>
        }
      >
        <div className="card-body-flush table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="w-120">
                  Dept. Code
                </th>
                <th scope="col" className="w-120">
                  Acc Code
                </th>
                <th scope="col">Account Name</th>
                <th scope="col">Description</th>
                <th scope="col" className="text-center w-90">
                  Currency
                </th>
                <th scope="col" className="text-right w-110">
                  Rate
                </th>
                <th scope="col" className="text-right w-140">
                  Debit
                </th>
                <th scope="col" className="text-right w-140">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 &&
                isLoading &&
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
              {rows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="cc-empty-row-text">
                    {t('cc.noData')}
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                // A zero leg (e.g. gateway net=0.00, kept for a standard layout) that
                // has no account is display-only and never posts — show a dash, not the
                // red MISSING alarm reserved for a real amount lacking its mapping.
                const posts = !!(r.debit || r.credit)
                return (
                  <tr key={`${r.dept}-${r.acc}-${r.desc}-${i}`}>
                    <td className={!r.dept && posts ? 'missing-cell animate-pulse' : ''}>
                      {r.dept ||
                        (posts ? (
                          <span className="cc-missing-cell-text">
                            <AlertCircle size={12} /> MISSING
                          </span>
                        ) : (
                          '—'
                        ))}
                    </td>
                    <td className={!r.acc && posts ? 'missing-cell animate-pulse' : ''}>
                      {r.acc ||
                        (posts ? (
                          <span className="cc-missing-cell-text">
                            <AlertCircle size={12} /> MISSING
                          </span>
                        ) : (
                          '—'
                        ))}
                    </td>
                    <td className="cc-account-name-cell">{getAccName(r.acc)}</td>
                    <td>{r.desc}</td>
                    <td className="text-center">THB</td>
                    <td className="text-right text-mono">1.00000000</td>
                    <td className="text-right">{fmt(r.debit)}</td>
                    <td className="text-right">{fmt(r.credit)}</td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="jv-total-row">
                  <td colSpan={6} className="text-right">
                    TOTAL:
                  </td>
                  <td className="text-right">{fmt(totalDr)}</td>
                  <td className="text-right">{fmt(totalCr)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onBack}>
            <ArrowLeft size={14} /> {t('cc.back')}
          </button>
          <button type="button" className="btn-cancel cc-mr-auto" onClick={onGoMapping}>
            <Settings size={14} /> {t('cc.mappingSettings')}
          </button>
          <button
            type="button"
            className="btn-icon"
            title={t('cc.refreshMapping')}
            onClick={loadConfig}
            disabled={configLoading}
          >
            <RefreshCw size={14} className={configLoading ? 'animate-spin' : ''} />
          </button>
          <div className="form-actions-sep" />
          <button
            type="button"
            className="btn-submit"
            disabled={rows.length === 0 || submitting || isImbalanced}
            onClick={() => (hasMissing ? setWarningModal(true) : onSubmit(rows))}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UploadCloud size={14} />
            )}
            {submitting ? t('cc.submitting') : t('cc.confirmSubmit')}
          </button>
        </div>
      </Card>

      <CustomModal
        show={warningModal}
        type="warning"
        title={t('cc.incompleteMapping')}
        message={t('cc.incompleteMappingMsg', { fields: unmappedFields.join(', ') })}
        confirmText={t('cc.goMappingSettings')}
        cancelText={t('cc.close')}
        onConfirm={() => {
          setWarningModal(false)
          onGoMapping()
        }}
        onCancel={() => setWarningModal(false)}
      />
    </div>
  )
}
