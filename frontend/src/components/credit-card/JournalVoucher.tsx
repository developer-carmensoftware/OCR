import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FileText, Receipt, ArrowLeft, ExternalLink, ArrowRight } from 'lucide-react'
import { fetchAccountCodes } from '../../lib/api/carmen'
import { getCarmenUrl } from '../../lib/url'
import Card from '../common/Card'
import Badge from '../common/Badge'
import CustomModal from '../common/CustomModal'
import type { JvRow } from '../../hooks/credit-card/useOcrSubmission'

interface Props {
  jvRows: JvRow[]
  headerData: Record<string, string>
  filePrefix?: string
  fileSource?: string
  description?: string
  carmenJvId?: string | null
  onFinish: () => void
  onBack?: () => void
}

const fmt = (n: number) => (n ? n.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00')

const JV_HEADERS = [
  'Dept.',
  'Account #',
  'Account Name',
  'Comment',
  'Currency',
  'Rate',
  'Dr. Amount',
  'Cr. Amount',
  'Dr. Base',
  'Cr. Base',
]

let _accCache: Record<string, string> | null = null

export default function JournalVoucher({
  jvRows,
  headerData,
  filePrefix,
  fileSource: _fileSource,
  description,
  carmenJvId,
  onFinish,
  onBack,
}: Props) {
  const totalDr = jvRows.reduce((s, r) => s + r.debit, 0)
  const totalCr = jvRows.reduce((s, r) => s + r.credit, 0)
  const [accNameMap, setAccNameMap] = useState<Record<string, string>>(_accCache || {})
  const [noJvModal, setNoJvModal] = useState(false)

  useEffect(() => {
    if (_accCache) return
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
  }, [])

  const getAccName = (acc: string) => accNameMap[acc] || ''

  const handleOpenJv = () => {
    if (carmenJvId) window.open(getCarmenUrl(`/glJv/${carmenJvId}/show`), '_blank')
    else setNoJvModal(true)
  }

  const metaFields = [
    { label: 'Prefix', value: filePrefix || 'IC', flex: '1 1 80px', minWidth: '60px' },
    { label: 'Voucher No.', value: carmenJvId || '—', flex: '2 1 140px', minWidth: '100px' },
    { label: 'Date', value: headerData.DocDate || '—', flex: '1 1 110px', minWidth: '90px' },
    { label: 'Description', value: description || '—', flex: '3 1 180px', minWidth: '0' },
  ]

  return (
    <>
      <div className="section-header">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={16} /> Step 5: Journal Voucher
        </span>
      </div>

      <Card
        icon={<Receipt size={16} />}
        title="Journal Voucher"
        right={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Badge variant="gray">OCC</Badge>
            <Badge variant="blue">Normal</Badge>
          </div>
        }
      >
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {metaFields.map(({ label, value, flex, minWidth }) => (
              <div key={label} className="jv-meta-field" style={{ flex, minWidth }}>
                <span className="jv-meta-label">{label}</span>
                <div className="jv-meta-value">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-body-flush">
          <div className="table-wrapper">
            <table className="data-table jv-table">
              <thead>
                <tr>
                  {JV_HEADERS.map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={
                        i >= 6 ? 'text-right' : i === 2 || i === 3 ? 'text-left' : 'text-center'
                      }
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jvRows.map((r, i) => (
                  <tr key={i}>
                    <td className="text-center">{r.dept}</td>
                    <td className="text-center text-mono">{r.acc}</td>
                    <td>{getAccName(r.acc)}</td>
                    <td>{r.desc}</td>
                    <td className="text-center">THB</td>
                    <td className="text-right text-mono">1.00000000</td>
                    <td className="text-right text-mono">{fmt(r.debit)}</td>
                    <td className="text-right text-mono">{fmt(r.credit)}</td>
                    <td className="text-right text-mono">{fmt(r.debit)}</td>
                    <td className="text-right text-mono">{fmt(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="jv-total-row">
                  <td colSpan={6} className="text-right">
                    TOTAL:
                  </td>
                  <td className="text-right">{fmt(totalDr)}</td>
                  <td className="text-right">{fmt(totalCr)}</td>
                  <td className="text-right">{fmt(totalDr)}</td>
                  <td className="text-right">{fmt(totalCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="form-actions">
          {onBack && (
            <button
              type="button"
              className="btn-cancel"
              onClick={onBack}
              style={{ marginRight: 'auto' }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <button
            type="button"
            className="btn-cancel"
            onClick={handleOpenJv}
            disabled={!carmenJvId}
            title={carmenJvId ? `View JV #${carmenJvId}` : 'Waiting for JV ID'}
          >
            <ExternalLink size={14} /> View JV page
          </button>
          <div className="form-actions-sep" />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.35rem',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <ArrowRight size={12} /> Next Step: <strong>Input Tax Reconciliation</strong> — Verify
              Input Tax
            </span>
            <button
              type="button"
              className="btn-submit"
              onClick={() => {
                toast.info('Proceeding to Step 6: Input Tax Reconciliation')
                onFinish()
              }}
            >
              <ArrowRight size={14} /> Next
            </button>
          </div>
        </div>
      </Card>

      <CustomModal
        show={noJvModal}
        type="warning"
        title="Voucher ID Not Found"
        message="No Voucher ID received from Carmen\nThis may be due to a failed GL JV in the previous step"
        confirmText="Close"
        onConfirm={() => setNoJvModal(false)}
      />
    </>
  )
}
