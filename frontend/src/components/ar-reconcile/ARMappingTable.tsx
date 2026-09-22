import { useState } from 'react'
import '../../styles/pages/ar-reconcile.css'
import { AlertTriangle, CheckCircle2, Info, Plus, Table2, XCircle } from 'lucide-react'
import AISuggestBar from '../common/AISuggestBar'
import Badge from '../common/Badge'
import MappingRow from '../common/MappingRow'
import Card from '../admin/ui/Card'
import '../../styles/components/mapping-row.css'
import { useT } from '../../i18n/LanguageContext'
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
  const { t } = useT()
  const [newType, setNewType] = useState('')

  const total = ctrl.rows.length
  const mapped = ctrl.mappedCount(ctrl.postType)
  const missing = total - mapped
  const postTypeLabel = t(
    ctrl.postType === 'Detail' ? 'review.arPostTypeDetail' : 'review.arPostTypeSummary'
  )

  const add = () => {
    ctrl.addCustomType(newType)
    setNewType('')
  }

  return (
    <Card
      title={t('ar.mappingTitle')}
      icon={<Table2 size={16} />}
      actions={
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
      }
    >
      <div role="status" className={`cc-mapping-status ${missing > 0 ? 'missing' : 'ready'}`}>
        {total === 0 ? (
          <>
            <Info size={14} className="cc-flex-shrink-0" />
            <span>{t('ar.mappingEmpty')}</span>
          </>
        ) : missing > 0 ? (
          <>
            <AlertTriangle size={14} color="var(--rose)" className="cc-flex-shrink-0" />
            <span>{t('ar.mappingMissing', { missing, total })}</span>
            <Badge variant="error" className="cc-required-badge">
              {t('ar.mappingBlocks')}
            </Badge>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} className="cc-flex-shrink-0" />
            <span>{t('ar.mappingAllMapped', { total })}</span>
            <span className="cc-ready-subtext">{t('ar.mappingReady')}</span>
          </>
        )}
      </div>

      <div className="table-wrapper ar-table">
        <div className="pm-grid-header">
          <div>{t('review.arColPaymentType')}</div>
          <div>{t('ar.colDeptCode')}</div>
          <div>{t('ar.colAccCode')}</div>
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
              deptPlaceholder={t('review.jvDeptPlaceholder')}
              accPlaceholder={t('review.jvAccountPlaceholder')}
              deptLabel={t('ar.colDeptCode')}
              accLabel={t('ar.colAccCode')}
              suggestion={ctrl.suggestions[row.payment_type_code] ?? null}
              onAccept={() => ctrl.acceptSuggestion(row.payment_type_code)}
              onReject={() => ctrl.rejectSuggestion(row.payment_type_code)}
              trailing={
                <button
                  type="button"
                  className="pm-remove-btn"
                  onClick={() => ctrl.removeType(row.payment_type_code)}
                  title={t('ar.removeType', { type: row.payment_type_code })}
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
          className="admin-form-input ar-add-input"
          value={newType}
          placeholder={t('ar.addPlaceholder')}
          aria-label={t('ar.addType')}
          onChange={e => setNewType(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn btn-outline" onClick={add}>
          <Plus size={14} /> {t('ar.addType')}
        </button>
        <span className="ar-row-count">
          {t('ar.rowCount', { count: total, postType: postTypeLabel })}
        </span>
      </div>
    </Card>
  )
}
