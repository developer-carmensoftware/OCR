import { useState } from 'react'
import { List, Calculator } from 'lucide-react'
import { DETAIL_COLUMNS, DETAIL_LABELS } from '../../constants'
import type { DetailColumn } from '../../constants/fields'

export interface DetailRow {
  Transaction?: string
  PayAmt?: string
  CommisAmt?: string
  TaxAmt?: string
  Total?: string
  _uid?: string
  [key: string]: string | undefined
}

interface Props {
  details: DetailRow[]
  onUpdate?: (rowIndex: number, col: string, value: string) => void
  onAddRow?: () => void
  onDeleteRow?: (index: number) => void
  readOnly?: boolean
}

const AMOUNT_FIELDS: DetailColumn[] = ['PayAmt', 'CommisAmt', 'TaxAmt', 'Total']

function formatAmount(value: unknown): string {
  const str = String(value ?? '').replace(/,/g, '').trim()
  if (str === '') return ''
  const num = parseFloat(str)
  if (isNaN(num)) return str
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function sumColumn(details: DetailRow[], col: string): number {
  return details.reduce((sum, row) => {
    const val = parseFloat(String(row[col] || 0).replace(/,/g, ''))
    return sum + (isNaN(val) ? 0 : val)
  }, 0)
}

export default function DetailTable({ details, onUpdate, onAddRow: _onAddRow, onDeleteRow: _onDeleteRow, readOnly }: Props) {
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: string } | null>(null)

  return (
    <>
      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left">
            <List size={16} /> Details
          </div>
          <span className="row-count">{details.length} items</span>
        </div>
        <div className="card-body-flush table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {DETAIL_COLUMNS.map(col => {
                  const labelHtml = DETAIL_LABELS[col] || col
                  return <th key={col} scope="col" dangerouslySetInnerHTML={{ __html: labelHtml }} />
                })}
              </tr>
            </thead>
            <tbody>
              {details.map((row, rowIdx) => (
                <tr
                  key={row._uid ?? rowIdx}
                  style={{ animation: `fadeUp 0.25s var(--ease) ${Math.min(rowIdx * 40, 400)}ms both` }}
                >
                  {DETAIL_COLUMNS.map(col => {
                    const isAmountField = AMOUNT_FIELDS.includes(col)
                    const isEditing = focusedCell?.row === rowIdx && focusedCell?.col === col
                    const displayValue =
                      isAmountField && !isEditing
                        ? formatAmount(row[col])
                        : String(row[col] ?? '').replace(/,/g, '')
                    return (
                      <td key={col}>
                        <input
                          type="text"
                          aria-label={col}
                          className="detail-input"
                          value={displayValue}
                          readOnly={readOnly}
                          onFocus={() => !readOnly && isAmountField && setFocusedCell({ row: rowIdx, col })}
                          onBlur={() => setFocusedCell(null)}
                          onChange={e => !readOnly && onUpdate?.(rowIdx, col, e.target.value)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-card total-summary-card">
        <div className="card-title">
          <div className="card-title-left">
            <Calculator size={16} /> Total Summary
          </div>
        </div>
        <div className="card-body">
          <div className="total-summary-grid">
            {AMOUNT_FIELDS.map(col => {
              const label = DETAIL_LABELS[col] ? DETAIL_LABELS[col].split('<br>')[0] : col
              const total = sumColumn(details, col)
              return (
                <div key={col} className="total-summary-item">
                  <div className="total-summary-label">{label}</div>
                  <div className="total-summary-value">
                    {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
