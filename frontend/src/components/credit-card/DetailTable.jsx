import { useState } from 'react'
import { List, Calculator } from 'lucide-react'
import { DETAIL_COLUMNS, DETAIL_LABELS } from '../../constants'

const formatAmount = value => {
  const str = String(value ?? '')
    .replace(/,/g, '')
    .trim()
  if (str === '') return ''
  const num = parseFloat(str)
  if (isNaN(num)) return str
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// cc// คำนวณค่ารวมทั้งหมดของแต่ละคอลัมน์ที่เป็นตัวเลข
const sumColumn = (details, col) => {
  return details.reduce((sum, row) => {
    const val = parseFloat(String(row[col] || 0).replace(/,/g, ''))
    return sum + (isNaN(val) ? 0 : val)
  }, 0)
}

const amountFields = ['PayAmt', 'CommisAmt', 'TaxAmt', 'Total']

// cc// ลบ ACTION column และปุ่มเพิ่มรายการ, เพิ่ม Total Summary Card
export default function DetailTable({ details, onUpdate, onAddRow, onDeleteRow, readOnly }) {
  const [focusedCell, setFocusedCell] = useState(null) // { row, col }

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
                  return <th key={col} dangerouslySetInnerHTML={{ __html: labelHtml }} />
                })}
              </tr>
            </thead>
            <tbody>
              {details.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    animation: `fadeUp 0.25s var(--ease) ${Math.min(rowIdx * 40, 400)}ms both`,
                  }}
                >
                  {DETAIL_COLUMNS.map(col => {
                    const isAmountField = amountFields.includes(col)
                    const isEditing = focusedCell?.row === rowIdx && focusedCell?.col === col
                    // While focused: show raw number (no commas) so user can type freely
                    // While blurred: show formatted value with commas
                    const displayValue =
                      isAmountField && !isEditing
                        ? formatAmount(row[col])
                        : String(row[col] ?? '').replace(/,/g, '')
                    return (
                      <td key={col}>
                        <input
                          type="text"
                          className="detail-input"
                          value={displayValue}
                          readOnly={readOnly}
                          onFocus={() =>
                            !readOnly && isAmountField && setFocusedCell({ row: rowIdx, col })
                          }
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

      {/* Total Summary Card */}
      <div className="data-card total-summary-card">
        <div className="card-title">
          <div className="card-title-left">
            <Calculator size={16} /> Total Summary
          </div>
        </div>
        <div className="card-body">
          <div className="total-summary-grid">
            {amountFields.map(col => {
              const label = DETAIL_LABELS[col] ? DETAIL_LABELS[col].split('<br>')[0] : col
              const total = sumColumn(details, col)
              return (
                <div key={col} className="total-summary-item">
                  <div className="total-summary-label">{label}</div>
                  <div className="total-summary-value">
                    {total.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
