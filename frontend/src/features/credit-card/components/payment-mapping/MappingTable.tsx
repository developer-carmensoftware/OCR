import { useState } from 'react'
import { Plus, XCircle } from 'lucide-react'
import MappingRow from '@/features/credit-card/components/MappingRow'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'
import type {
  MasterAccount,
  MasterDepartment,
} from '@/features/credit-card/hooks/mapping/useMappingData'
import { statusOf, type MappingItem, type MappingSet, type MappingStatus } from './types'

/**
 * The rows of one mapping set, with their column header directly above them and the
 * add-a-type row directly below. `items` arrives already filtered and ordered — the dialog
 * decides what is visible; this only draws it.
 */

const STATUS_LABEL: Record<MappingStatus, TKey> = {
  invalid: 'cc.pmStatusInvalid',
  needs: 'cc.pmStatusNeeds',
  suggested: 'cc.pmStatusSuggested',
  mapped: 'cc.pmStatusMapped',
}

interface Props {
  set: MappingSet
  items: MappingItem[]
  selected: Set<string>
  onToggle: (code: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  /** Open the add row on mount — the empty state's own call to action. */
  startAdding?: boolean
}

export default function MappingTable({
  set,
  items,
  selected,
  onToggle,
  onToggleAll,
  masterAccounts,
  masterDepartments,
  startAdding = false,
}: Props) {
  const { t } = useT()
  const [adding, setAdding] = useState(startAdding)
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const allChecked = items.length > 0 && items.every(i => selected.has(i.code))
  const someChecked = !allChecked && items.some(i => selected.has(i.code))

  const submit = () => {
    if (!set.add) return
    const err = set.add(draft)
    if (err === 'blank') setAddError(t('cc.pmAddBlank'))
    else if (err === 'duplicate')
      setAddError(t('cc.pmAddDuplicate', { code: draft.trim().toUpperCase() }))
    else {
      // Stays open for the next one: a new bank's list is typed in several at a time.
      setDraft('')
      setAddError(null)
    }
  }

  return (
    <div className="pm-table">
      {items.length > 0 && (
        <div className="pm-grid-header pm-row--selectable">
          <label className="pm-select">
            <input
              type="checkbox"
              checked={allChecked}
              ref={el => {
                if (el) el.indeterminate = someChecked
              }}
              onChange={e => onToggleAll(e.target.checked)}
              aria-label={t('cc.pmSelectAll')}
            />
          </label>
          <div>{t('cc.ptColType')}</div>
          <div>{t('cc.mapDeptCode')}</div>
          <div>{t('cc.mapAccCode')}</div>
          <div />
        </div>
      )}

      {items.map(item => {
        const status = statusOf(item, masterDepartments)
        return (
          <MappingRow
            key={`${set.id}-${item.code}`}
            type={item.code}
            status={status}
            statusLabel={t(STATUS_LABEL[status])}
            value={item.mapping}
            onChange={(field, value) => set.setField(item.code, field, value)}
            masterAccounts={masterAccounts}
            masterDepartments={masterDepartments}
            suggestion={item.suggestion ?? null}
            onAccept={() => set.accept(item.code)}
            onReject={() => set.reject(item.code)}
            acceptLabel={t('cc.pmAccept')}
            rejectLabel={t('cc.pmReject')}
            selected={selected.has(item.code)}
            onSelect={checked => onToggle(item.code, checked)}
            selectLabel={t('cc.pmSelectRow', { code: item.code })}
            tag={item.onDocument ? t('cc.pmOnDocument') : undefined}
            fallbackName="(AI)"
            deptPlaceholder={t('cc.ptDeptPh')}
            accPlaceholder={t('cc.ptAccPh')}
            deptLabel={t('cc.mapDeptCode')}
            accLabel={t('cc.mapAccCode')}
            allowedNotice={(n, dept) => t('cc.mapAllowedAcc', { n, dept })}
            trailing={
              item.removable && set.remove ? (
                <button
                  type="button"
                  className="pm-remove-btn"
                  onClick={() => set.remove?.(item.code)}
                  title={t('cc.pmRemove', { code: item.code })}
                  aria-label={t('cc.pmRemove', { code: item.code })}
                >
                  <XCircle size={16} />
                </button>
              ) : undefined
            }
          />
        )
      })}

      {set.add &&
        (adding ? (
          <div className="pm-add">
            <input
              type="text"
              className="admin-form-input pm-add-input"
              value={draft}
              placeholder={t('cc.pmAddPlaceholder')}
              aria-label={t('cc.pmAdd')}
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? `pm-add-error-${set.id}` : undefined}
              // A deliberate click opened it, so the caret belongs here.
              autoFocus
              onChange={e => {
                setDraft(e.target.value)
                setAddError(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                } else if (e.key === 'Escape') {
                  // Closes this row, not the dialog around it.
                  e.stopPropagation()
                  setAdding(false)
                  setDraft('')
                  setAddError(null)
                }
              }}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={submit}>
              {t('cc.pmAddConfirm')}
            </button>
            <button
              type="button"
              className="pm-link-btn"
              onClick={() => {
                setAdding(false)
                setDraft('')
                setAddError(null)
              }}
            >
              {t('common.cancel')}
            </button>
            {addError && (
              <p className="pm-add-error" id={`pm-add-error-${set.id}`} role="alert">
                {addError}
              </p>
            )}
          </div>
        ) : (
          <button type="button" className="pm-add-trigger" onClick={() => setAdding(true)}>
            <Plus size={14} /> {t('cc.pmAdd')}
          </button>
        ))}
    </div>
  )
}
