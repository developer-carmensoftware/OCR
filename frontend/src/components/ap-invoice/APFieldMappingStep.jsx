import { SlidersHorizontal, ArrowLeft, ArrowRight } from 'lucide-react'
import { isNumFld, fmt } from '../../constants/apInvoice'

export default function APFieldMappingStep({
  t,
  lineItems,
  fieldMappings,
  availableFields,
  onMappingChange,
  onBack,
  onConfirm,
}) {
  const COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

  return (
    <div className="data-card">
      <div className="card-title">
        <div className="card-title-left">
          <SlidersHorizontal size={16} />
          {t.mapTitle}
        </div>
      </div>

      <div className="card-body-flush">
        <div className="mapping-table-wrap" style={{ padding: '0.5rem' }}>
          <table className="mapping-table">
            <thead>
              <tr>
                {COLS.map((c, index) => {
                  const val = fieldMappings[`col${c}`]
                  return (
                    <th key={c}>
                      <div className="col-label">Column {index + 1}</div>
                      <select
                        value={val}
                        onChange={e => onMappingChange(c, e.target.value)}
                        className={val === 'ignore' ? 'ignored' : 'mapped'}
                      >
                        {availableFields.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {lineItems.slice(0, 3).map((item, ri) => (
                <tr key={ri}>
                  {COLS.map(c => {
                    const fld = fieldMappings[`col${c}`]
                    const ignored = fld === 'ignore'
                    const numeric = isNumFld(fld)
                    return (
                      <td key={c} className={ignored ? 'is-ignored' : numeric ? 'is-numeric' : ''}>
                        {ignored
                          ? '(Ignored)'
                          : numeric && item[fld] !== undefined
                            ? fmt(item[fld])
                            : item[fld] || '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {lineItems.length > 3 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      textAlign: 'center',
                      color: 'var(--text-4)',
                      fontStyle: 'italic',
                      fontSize: '0.8rem',
                      padding: '0.75rem',
                    }}
                  >
                    … View {lineItems.length - 3} more items in the next step
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ap-step-nav">
        <button className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={14} /> {t.backUpload}
        </button>
        <button className="btn btn-primary" onClick={onConfirm}>
          {t.confirmMap} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
