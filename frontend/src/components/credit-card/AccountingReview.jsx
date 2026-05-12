import { useState, useEffect } from 'react'
import { CheckCheck, AlertTriangle, Info, FileText, Loader2, AlertCircle, ArrowLeft, Settings, RefreshCw, UploadCloud } from 'lucide-react'
import { SkeletonRow } from '../common/Skeleton'
import CustomModal from '../common/CustomModal'
import Card from '../common/Card'
import Badge from '../common/Badge'
import { fetchAccountCodes } from '../../lib/api/carmen'
import { toNum, fmt } from '../../lib/format'
import { useAccountingConfig } from '../../hooks/useAccountingConfig'

let _accCache = null

function buildRows(details, config) {
  const { mappings = {}, paymentAmount = {} } = config
  const rows = []

  const addRow = (cfg, amount, desc, isDebit) => {
    if (!amount) return
    rows.push(isDebit
      ? { dept: cfg.dept, acc: cfg.acc, desc, debit: amount, credit: 0 }
      : { dept: cfg.dept, acc: cfg.acc, desc, debit: 0, credit: amount }
    )
  }

  details.forEach(detail => {
    const payType = detail.Transaction || 'UNKNOWN'
    const amtCfg  = paymentAmount[payType] || { dept: '', acc: '' }
    const commCfg = mappings.commission    || { dept: '', acc: '' }
    const taxCfg  = mappings.tax           || { dept: '', acc: '' }
    const netCfg  = mappings.net           || { dept: '', acc: '' }

    addRow(amtCfg,  toNum(detail.PayAmt),    payType,                    false)
    addRow(commCfg, toNum(detail.CommisAmt), 'Credit card commission',   true)
    addRow(taxCfg,  toNum(detail.TaxAmt),    'Input Tax',                true)
    addRow(netCfg,  toNum(detail.Total),     'Bank Account',             true)
  })
  return rows
}


export default function AccountingReview({ details, headerData = {}, onBack, onSubmit, onGoMapping, submitting = false }) {
  const { config, refresh: loadConfig } = useAccountingConfig()
  const [warningModal, setWarningModal] = useState(false)
  const [accNameMap, setAccNameMap] = useState(_accCache || {})
  const [accLoading, setAccLoading] = useState(!_accCache)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (_accCache) return
    setAccLoading(true)
    fetchAccountCodes()
      .then(list => {
        const map = {}
        list.forEach(a => { if (a.AccCode) map[a.AccCode] = a.Description || '' })
        _accCache = map
        setAccNameMap(map)
      })
      .catch(() => {})
      .finally(() => setAccLoading(false))
  }, [])

  const getAccName = acc => accNameMap[acc] || ''



  const rows    = config ? buildRows(details, config) : []
  const totalDr = rows.reduce((s, r) => s + r.debit,  0)
  const totalCr = rows.reduce((s, r) => s + r.credit, 0)

  const unmappedFields = []
  if (config) {
    if (!config.filePrefix) unmappedFields.push('File Prefix')
    const m = config.mappings || {}
    if (!m.commission?.acc) unmappedFields.push('Credit card commission')
    if (!m.tax?.acc)        unmappedFields.push('Input Tax')
    if (!m.net?.acc)        unmappedFields.push('Bank Account')
    const detailTypes = [...new Set(details.map(d => d.Transaction).filter(Boolean))]
    detailTypes.forEach(pt => { if (!config.paymentAmount?.[pt]?.acc) unmappedFields.push(pt) })
  }
  const hasMissing = !config || unmappedFields.length > 0

  const configBadges = config
    ? [
        { label: `Prefix: ${config.filePrefix || '-'}`,     variant: 'info' },
        { label: `Source: ${config.fileSource || '-'}`,     variant: 'gray' },
        { label: `Description: ${config.description ? `${config.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}` : '-'}`, variant: 'gray' },
      ]
    : []

  return (
    <div>
      <div className="section-header">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} /> Step 4: Accounting Review (Journal Concept)</span>
      </div>

      {hasMissing && (
        <div className="mapping-alert">
          <AlertTriangle size={16} />
          <span style={{ flex: 1 }}>
            Missing account mapping for: <strong>{unmappedFields.join(', ')}</strong>
          </span>
          <button className="btn btn-sm btn-danger" onClick={onGoMapping}>
            Edit Mapping
          </button>
        </div>
      )}

      {!config && (
        <div className="mapping-alert">
          <Info size={16} />
          <span style={{ flex: 1 }}>No Account Mapping configured</span>
          <button className="btn btn-sm btn-primary" onClick={onGoMapping}>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-4)', fontWeight: 400, marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Loader2 size={12} className="animate-spin" /> Loading account names...
              </span>
            )}
          </>
        }
        right={
          <div className="card-title-badges">
            {configBadges.map(({ label, variant }) => (
              <Badge key={label} variant={variant} pill={false}>{label}</Badge>
            ))}
          </div>
        }
      >
        <div className="card-body-flush table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th width="120">Dept. Code</th>
                <th width="120">Acc Code</th>
                <th>Account Name</th>
                <th>Description</th>
                <th width="90" className="text-center">Currency</th>
                <th width="110" className="text-right">Rate</th>
                <th width="140" className="text-right">Debit</th>
                <th width="140" className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && accLoading && Array.from({ length: 4 }).map((_, i) => (
                <SkeletonRow key={i} cols={8} />
              ))}
              {rows.length === 0 && !accLoading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                    No data — Please configure Account Mapping first
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className={!r.dept ? 'missing-cell animate-pulse' : ''}>{r.dept || <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><AlertCircle size={12} /> MISSING</span>}</td>
                  <td className={!r.acc  ? 'missing-cell animate-pulse' : ''}>{r.acc  || <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><AlertCircle size={12} /> MISSING</span>}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>{getAccName(r.acc)}</td>
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
                  <td colSpan={6} className="text-right">TOTAL:</td>
                  <td className="text-right">{fmt(totalDr)}</td>
                  <td className="text-right">{fmt(totalCr)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onBack}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className="btn-cancel" onClick={onGoMapping} style={{ marginRight: 'auto' }}>
            <Settings size={14} /> Mapping Settings
          </button>
          <button
            className="btn-icon"
            title="Refresh Mapping Data"
            onClick={() => { setRefreshing(true); loadConfig(); setTimeout(() => setRefreshing(false), 700) }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="form-actions-sep" />
          <button
            className="btn-submit"
            disabled={rows.length === 0 || submitting}
            onClick={() => hasMissing ? setWarningModal(true) : onSubmit(rows)}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
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
        onConfirm={() => { setWarningModal(false); onGoMapping() }}
        onCancel={() => setWarningModal(false)}
      />
    </div>
  )
}
