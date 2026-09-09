import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Plus, XCircle } from 'lucide-react'
import AISuggestBar from '../common/AISuggestBar'
import Badge from '../common/Badge'
import MappingRow from '../common/MappingRow'
import type { ARReconcileHook } from '../../hooks/ar-reconcile'

/**
 * Payment type → credit-side GL account, for the post type currently selected.
 *
 * The status line mirrors `MainMappingTable`'s three states rather than inventing a
 * fourth vocabulary: nothing to say yet reads as information, an incomplete table that a
 * document is waiting on reads as an error, a complete one reads as ready. The mockup put
 * a single amber bar here; amber is not an action colour in this system, and an unmapped
 * type is not a caution — it is the thing stopping a charged document from posting.
 */

interface Props {
  ctrl: ARReconcileHook
}

export default function ARMappingTable({ ctrl }: Props) {
  const [newType, setNewType] = useState('')

  const total = ctrl.rows.length
  const mapped = ctrl.mappedCount(ctrl.postType)
  const missing = total - mapped

  return (
    <div className="section">
      <div className="section-title cc-section-title-container">
        <div className="cc-flex-center-gap">
          <span>PAYMENT TYPE MAPPING</span>
        </div>
        <AISuggestBar
          onSuggest={() => void ctrl.runSuggest()}
          hasSuggestions={Object.values(ctrl.suggestions).some(s => s)}
          loading={ctrl.suggestLoading}
          disabled={
            ctrl.masterAccounts.length === 0 ||
            ctrl.masterDepartments.length === 0 ||
            ctrl.loadingOpts
          }
          onRefresh={() => void ctrl.reloadCodes()}
          refreshLoading={ctrl.loadingOpts}
        />
      </div>

      <div role="status" className={`cc-mapping-status ${missing > 0 ? 'missing' : 'ready'}`}>
        {total === 0 ? (
          <>
            <Info size={14} className="cc-flex-shrink-0" />
            <span>Add the payment types this bank prints, or wait for the first report</span>
          </>
        ) : missing > 0 ? (
          <>
            <AlertTriangle size={14} color="var(--rose)" className="cc-flex-shrink-0" />
            <span>
              <strong>{missing}</strong> of <strong>{total}</strong> still to map
            </span>
            <Badge variant="error" className="cc-required-badge">
              Blocks auto-posting
            </Badge>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} className="cc-flex-shrink-0" />
            <span>
              All <strong>{total}</strong> payment types mapped
            </span>
            <span className="cc-ready-subtext">Ready for JV</span>
          </>
        )}
      </div>

      <div className="table-wrapper ar-table">
        <div className="pm-grid-header">
          <div>Payment Type</div>
          <div>Department Code</div>
          <div>Account Code</div>
          <div />
        </div>

        {ctrl.rows.map(row => {
          const value = {
            dept: row.credit_dept_code || '',
            acc: row.credit_account_code || '',
          }
          const pending = !value.dept || !value.acc
          return (
            <MappingRow
              key={row.payment_type_code}
              type={row.payment_type_code}
              variant={pending ? 'pending' : 'ok'}
              value={value}
              onChange={(field, val) => ctrl.setRowMapping(row.payment_type_code, field, val)}
              masterAccounts={ctrl.masterAccounts}
              masterDepartments={ctrl.masterDepartments}
              suggestion={ctrl.suggestions[row.payment_type_code] ?? null}
              onAccept={() => ctrl.acceptSuggestion(row.payment_type_code)}
              onReject={() => ctrl.rejectSuggestion(row.payment_type_code)}
              trailing={
                <button
                  type="button"
                  className="pm-remove-btn"
                  onClick={() => ctrl.removeType(row.payment_type_code)}
                  title={`Remove ${row.payment_type_code}`}
                >
                  <XCircle size={16} />
                </button>
              }
            />
          )
        })}
      </div>

      <div className="ar-add-row">
        <input
          type="text"
          className="modal-input ar-add-input"
          value={newType}
          placeholder="Add a payment type, e.g. AMEX PREM"
          aria-label="New payment type"
          onChange={e => setNewType(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ctrl.addCustomType(newType)
              setNewType('')
            }
          }}
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            ctrl.addCustomType(newType)
            setNewType('')
          }}
        >
          <Plus size={14} /> Add type
        </button>
        <span className="ar-row-count">
          {total} {total === 1 ? 'row' : 'rows'} in {ctrl.postType}
        </span>
      </div>
    </div>
  )
}
