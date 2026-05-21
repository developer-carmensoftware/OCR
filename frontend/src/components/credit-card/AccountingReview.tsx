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
import { useAccountingConfig } from '../../hooks/useAccountingConfig'
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCheck size={16} /> Step 4: Accounting Review (Journal Concept)
        </span>
      </div>

      {hasMissing && (
        <div className="mapping-alert">
          <AlertTriangle size={16} />
          <span style={{ flex: 1 }}>
            Missing account mapping for: <strong>{unmappedFields.join(', ')}</strong>
          </span>
          <button type="button" className="btn btn-sm btn-danger" onClick={onGoMapping}>
            Edit Mapping
          </button>
        </div>
      )}
      {!rawConfig && (
        <div className="mapping-alert">
          <Info size={16} />
          <span style={{ flex: 1 }}>No Account Mapping configured</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={onGoMapping}>
            Go to Mapping Settings
          </button>
        </div>
      )}

      <Card
        icon={<FileText size={16} />}
        title={
          <>
            Journal Details
            {accLoading && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-4)',
                  fontWeight: 400,
                  marginLeft: '0.5rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Loader2 size={12} className="animate-spin" /> Loading account names...
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
                <th scope="col" style={{ width: 120 }}>
                  Dept. Code
                </th>
                <th scope="col" style={{ width: 120 }}>
                  Acc Code
                </th>
                <th scope="col">Account Name</th>
                <th scope="col">Description</th>
                <th scope="col" style={{ width: 90 }} className="text-center">
                  Currency
                </th>
                <th scope="col" style={{ width: 110 }} className="text-right">
                  Rate
                </th>
                <th scope="col" style={{ width: 140 }} className="text-right">
                  Debit
                </th>
                <th scope="col" style={{ width: 140 }} className="text-right">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 &&
                accLoading &&
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
              {rows.length === 0 && !accLoading && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}
                  >
                    No data — Please configure Account Mapping first
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className={!r.dept ? 'missing-cell animate-pulse' : ''}>
                    {r.dept || (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <AlertCircle size={12} /> MISSING
                      </span>
                    )}
                  </td>
                  <td className={!r.acc ? 'missing-cell animate-pulse' : ''}>
                    {r.acc || (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <AlertCircle size={12} /> MISSING
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
                    {getAccName(r.acc)}
                  </td>
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
            <ArrowLeft size={14} /> Back
          </button>
          <button
            type="button"
            className="btn-cancel"
            onClick={onGoMapping}
            style={{ marginRight: 'auto' }}
          >
            <Settings size={14} /> Mapping Settings
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Refresh Mapping Data"
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
            {submitting ? 'Submitting...' : 'Confirm and Submit'}
          </button>
        </div>
      </Card>

      <CustomModal
        show={warningModal}
        type="warning"
        title="Incomplete Account Mapping"
        message={`Please complete the account mapping before confirming:\n${unmappedFields.join(', ')}`}
        confirmText="Go to Mapping Settings"
        cancelText="Close"
        onConfirm={() => {
          setWarningModal(false)
          onGoMapping()
        }}
        onCancel={() => setWarningModal(false)}
      />
    </div>
  )
}
