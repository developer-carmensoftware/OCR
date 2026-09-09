import { AlertTriangle, Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import CustomSearchSelect from './CustomSearchSelect'
import { allowedAccountsForDept, isAccountAllowed } from '../../lib/deptAccounts'
import type { FieldMapping } from '../../types/api'
import type { MasterAccount, MasterDepartment } from '../../hooks/mapping/useMappingData'
import type { Suggestion } from '../../hooks/mapping/useMappingSuggestions'

/**
 * One "this payment type posts to this dept and account" row.
 *
 * Extracted from PaymentTypeModal, which had it written twice (required rows and
 * additional rows) and now renders this for both, so the rules that decide what a person
 * is allowed to pick live in one place: `allowedAccountsForDept` narrows the account list
 * to what Carmen's `DefaultAccount` permits for the chosen department, and
 * `isAccountAllowed` reddens a pair that is no longer legal because the department
 * changed under it. AR reconciliation is the third caller and the reason it moved.
 *
 * It keeps the `pm-*` class names it was born with rather than renaming them across a
 * shipped modal and its stylesheet — the grid they describe is the same three columns
 * plus actions wherever it appears.
 */

export type MappingRowVariant = 'pending' | 'ok' | 'custom'

interface Props {
  /** The payment type. Also the badge's label and the mapping key. */
  type: string
  variant: MappingRowVariant
  value: FieldMapping
  onChange: (field: keyof FieldMapping, value: string) => void
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  suggestion?: Suggestion | null
  onAccept?: () => void
  onReject?: () => void
  /** Shown for a code the AI proposed that Carmen's master list does not describe. */
  fallbackName?: string
  /** Rendered beside the badge — the remove button, for a type the BU typed itself. */
  trailing?: ReactNode
  deptPlaceholder?: string
  accPlaceholder?: string
}

export default function MappingRow({
  type,
  variant,
  value,
  onChange,
  masterAccounts,
  masterDepartments,
  suggestion = null,
  onAccept,
  onReject,
  fallbackName = '(AI/History code)',
  trailing,
  deptPlaceholder = 'Dept...',
  accPlaceholder = 'Acc...',
}: Props) {
  const deptFromMaster = suggestion?.dept
    ? masterDepartments.find(d => d.code === suggestion.dept)
    : null
  const deptTopChoice = suggestion?.dept
    ? {
        code: suggestion.dept,
        name: deptFromMaster?.name || fallbackName,
        name2: deptFromMaster?.name2,
        source: suggestion.source,
      }
    : null

  const acctOptions = allowedAccountsForDept(value.dept, masterDepartments, masterAccounts)
  const acctNotice =
    acctOptions.length < masterAccounts.length
      ? `${acctOptions.length} accounts allowed for ${value.dept}`
      : undefined

  const accFromMaster = suggestion?.acc ? masterAccounts.find(a => a.code === suggestion.acc) : null
  const accTopChoice = suggestion?.acc
    ? {
        code: suggestion.acc,
        name: accFromMaster?.name || fallbackName,
        name2: accFromMaster?.name2,
        source: suggestion.source,
      }
    : null

  return (
    <div
      data-pt={type}
      className={`pm-row pm-row--${variant === 'custom' ? 'custom' : `required-${variant}`}`}
    >
      <div className="pm-type-cell">
        <div className={`pm-type-badge pm-type-badge--${variant}`}>{type}</div>
        {variant === 'pending' && <AlertTriangle size={14} color="var(--rose)" />}
        {trailing}
      </div>
      <CustomSearchSelect
        value={value.dept}
        onChange={val => onChange('dept', val)}
        options={masterDepartments}
        placeholder={deptPlaceholder}
        topChoice={deptTopChoice?.code ? deptTopChoice : null}
        suggestedValue={suggestion?.dept ?? null}
      />
      <CustomSearchSelect
        value={value.acc}
        onChange={val => onChange('acc', val)}
        options={acctOptions}
        notice={acctNotice}
        placeholder={accPlaceholder}
        hasError={!isAccountAllowed(value.dept, value.acc, masterDepartments)}
        topChoice={accTopChoice?.code ? accTopChoice : null}
        suggestedValue={suggestion?.acc ?? null}
      />
      {suggestion && onAccept && onReject && (
        <div className="pm-suggest-actions">
          <button type="button" className="pm-accept-btn" onClick={onAccept} title="Accept">
            <Check size={13} />
          </button>
          <button type="button" className="pm-reject-btn" onClick={onReject} title="Reject">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
