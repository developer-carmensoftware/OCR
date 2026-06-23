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
import { toNum, fmt } from '../../lib/format'
import { useT } from '../../i18n/LanguageContext'
import { useAccountingConfig } from '../../hooks/credit-card'
import type { DetailRow } from './DetailTable'
import type { JvRow } from '../../hooks/credit-card/useOcrSubmission'

interface Props {
  details: DetailRow[]
  headerData?: Record<string, string>
  onBack: () => void
  onSubmit: (rows: JvRow[]) => void
  onGoMapping: () => void
  submitting?: boolean
}

interface BuiltRow extends JvRow {
  dept: string
  acc: string
  desc: string
  debit: number
  credit: number
}

let _accCache: Record<string, string> | null = null

function buildRows(details: DetailRow[], config: Record<string, unknown>): BuiltRow[] {
  const mappings = (config.mappings || {}) as Record<string, { dept?: string; acc?: string }>
  const paymentAmount = (config.paymentAmount || {}) as Record<
    string,
    { dept?: string; acc?: string }
  >
  const rows: BuiltRow[] = []

  const addRow = (
    cfg: { dept?: string; acc?: string },
    amount: number,
    desc: string,
    isDebit: boolean
  ) => {
    if (!amount) return
    rows.push(
      isDebit
        ? { dept: cfg.dept || '', acc: cfg.acc || '', desc, debit: amount, credit: 0 }
        : { dept: cfg.dept || '', acc: cfg.acc || '', desc, debit: 0, credit: amount }
    )
  }

  details.forEach(detail => {
    const payType = detail.Transaction || 'UNKNOWN'
    const amtCfg = paymentAmount[payType] || {}
    const commCfg = mappings.commission || {}
    const taxCfg = mappings.tax || {}
    const netCfg = mappings.net || {}
    addRow(amtCfg, toNum(detail.PayAmt), payType, false)
    addRow(commCfg, toNum(detail.CommisAmt), 'Credit card commission', true)
    addRow(taxCfg, toNum(detail.TaxAmt), 'Input Tax', true)
    addRow(netCfg, toNum(detail.Total), 'Bank Account', true)
  })
  return rows
}

export default function AccountingReview({
  details,
  headerData = {},
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
  const rows = rawConfig ? buildRows(details, rawConfig) : []
  // Rows depend on BOTH the accounting config and the account-name map. Account
  // names are module-cached, so on repeat visits accLoading is already false
  // while the config is still loading — gate on both to avoid a "No data" flash.
  const isLoading = configLoading || accLoading
  const totalDr = rows.reduce((s, r) => s + r.debit, 0)
  const totalCr = rows.reduce((s, r) => s + r.credit, 0)

  const unmappedFields: string[] = []
  if (rawConfig) {
    if (!rawConfig.filePrefix) unmappedFields.push('File Prefix')
    const m = (rawConfig.mappings || {}) as Record<string, { acc?: string }>
    if (!m.commission?.acc) unmappedFields.push('Credit card commission')
    if (!m.tax?.acc) unmappedFields.push('Input Tax')
    if (!m.net?.acc) unmappedFields.push('Bank Account')
    const pa = (rawConfig.paymentAmount || {}) as Record<string, { acc?: string }>
    const detailTypes = [...new Set(details.map(d => d.Transaction).filter(Boolean))] as string[]
    detailTypes.forEach(pt => {
      if (!pa[pt]?.acc) unmappedFields.push(pt)
    })
  }
  const hasMissing = !rawConfig || unmappedFields.length > 0

  const configBadges = rawConfig
    ? [
        { label: `Prefix: ${rawConfig.filePrefix || '-'}`, variant: 'info' as const },
        { label: `Source: ${rawConfig.fileSource || '-'}`, variant: 'gray' as const },
        {
          label: `Description: ${rawConfig.description ? `${rawConfig.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}` : '-'}`,
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
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className={!r.dept ? 'missing-cell animate-pulse' : ''}>
                    {r.dept || (
                      <span className="cc-missing-cell-text">
                        <AlertCircle size={12} /> MISSING
                      </span>
                    )}
                  </td>
                  <td className={!r.acc ? 'missing-cell animate-pulse' : ''}>
                    {r.acc || (
                      <span className="cc-missing-cell-text">
                        <AlertCircle size={12} /> MISSING
                      </span>
                    )}
                  </td>
                  <td className="cc-account-name-cell">{getAccName(r.acc)}</td>
                  <td>{r.desc}</td>
                  <td className="text-center">THB</td>
                  <td className="text-right text-mono">1.00000000</td>
                  <td className="text-right">{fmt(r.debit)}</td>
                  <td className="text-right">{fmt(r.credit)}</td>
                </tr>
              ))}
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
            disabled={rows.length === 0 || submitting}
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
