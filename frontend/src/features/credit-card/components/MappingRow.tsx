import { Check, Trash2 } from 'lucide-react'
import CustomSearchSelect from '@/shared/components/common/CustomSearchSelect'
import '@/styles/components/mapping-row.css'
import { allowedAccountsForDept } from '@/shared/lib/deptAccounts'
import type { FieldMapping } from '@/shared/types/api'
import type {
  MasterAccount,
  MasterDepartment,
} from '@/features/credit-card/hooks/mapping/useMappingData'
import type { Suggestion } from '@/features/credit-card/hooks/mapping/useMappingSuggestions'
import type { MappingStatus } from './payment-mapping/types'

/**
 * One "this payment type posts to this dept and account" row.
 *
 * The rules that decide what a person is allowed to pick live here and nowhere else:
 * `allowedAccountsForDept` narrows the account list to what Carmen's `DefaultAccount`
 * permits for the chosen department, and an `invalid` status reddens the account a
 * department change made illegal.
 *
 * State is carried by `status`, not by colouring the whole row: the payment type is a
 * neutral code, a dot and a thin edge say how far along it is, and the words are there
 * for a screen reader (WCAG 1.4.1). The old solid red/green badges made a list of fifteen
 * unmapped types read as fifteen errors.
 *
 * Two kinds of action, kept apart on purpose. Accept/Dismiss answer the AI suggestion —
 * pressed often, row after row, and harmless (the AI can be asked again). Remove takes the
 * payment type and the account already picked for it out of the list — pressed rarely,
 * and it loses work. They used to be three same-size icons 5px apart, two of them an X;
 * now the suggestion's pair is labelled words beside the suggestion, and Remove is a
 * trash icon in its own slot at the far edge, past a divider, with an undo behind it.
 *
 * The `pm-*` class names are the ones it was born with in the payment-type modal.
 */

interface Props {
  /** The payment type. Also the row's label and the mapping key. */
  type: string
  status: MappingStatus
  /** Read out with the status dot, e.g. "Needs mapping". */
  statusLabel: string
  value: FieldMapping
  // Narrower than `keyof FieldMapping`: this component only ever edits dept/acc.
  // `source` is set once at creation (which layout a row came from) and never by hand.
  onChange: (field: 'dept' | 'acc', value: string) => void
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  suggestion?: Suggestion | null
  onAccept?: () => void
  onReject?: () => void
  acceptLabel?: string
  dismissLabel?: string
  /** Checkbox for bulk apply; omitted = no selection column. */
  selected?: boolean
  onSelect?: (checked: boolean) => void
  selectLabel?: string
  /** A short tag after the code, e.g. "On document". */
  tag?: string
  /** Shown for a code the AI proposed that Carmen's master list does not describe. */
  fallbackName?: string
  /** Omitted for a row that cannot be removed (a type printed on the scan). */
  onRemove?: () => void
  removeLabel?: string
  deptPlaceholder?: string
  accPlaceholder?: string
  /** Names the two pickers once the row stacks and the column header is gone. A
   *  placeholder cannot do this job: it disappears the moment a value is picked, which is
   *  exactly when the reader most needs to know which code they are looking at. */
  deptLabel?: string
  accLabel?: string
  /** Allowed-accounts note above the account list; `{n}` and `{dept}` are filled in. */
  allowedNotice?: (n: number, dept: string) => string
}

export default function MappingRow({
  type,
  status,
  statusLabel,
  value,
  onChange,
  masterAccounts,
  masterDepartments,
  suggestion = null,
  onAccept,
  onReject,
  acceptLabel = 'Accept',
  dismissLabel = 'Dismiss',
  selected = false,
  onSelect,
  selectLabel,
  tag,
  fallbackName = '(AI/History code)',
  onRemove,
  removeLabel = 'Remove',
  deptPlaceholder = 'Dept...',
  accPlaceholder = 'Acc...',
  deptLabel = 'Dept',
  accLabel = 'Account',
  allowedNotice = (n, dept) => `${n} accounts allowed for ${dept}`,
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
      ? allowedNotice(acctOptions.length, value.dept ?? '')
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
      data-status={status}
      className={`pm-row pm-row--${status}${onSelect ? ' pm-row--selectable' : ''}${
        selected ? ' is-selected' : ''
      }`}
    >
      {onSelect && (
        <label className="pm-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={e => onSelect(e.target.checked)}
            aria-label={selectLabel ?? type}
          />
        </label>
      )}
      <div className="pm-type-cell">
        <span className="pm-status-dot" aria-hidden="true" />
        <span className="pm-type-code" title={type}>
          {type}
        </span>
        <span className="sr-only">{statusLabel}</span>
        {tag && <span className="pm-type-tag">{tag}</span>}
      </div>
      {/* `display: contents` above the stacking breakpoint, so these wrappers generate no
          box and the row's grid tracks are untouched on a desktop. Below it they become
          the label/value pair, with the name coming from `data-label`. */}
      <div className="pm-cell" data-label={deptLabel}>
        <CustomSearchSelect
          value={value.dept}
          onChange={val => onChange('dept', val)}
          options={masterDepartments}
          placeholder={deptPlaceholder}
          topChoice={deptTopChoice?.code ? deptTopChoice : null}
          suggestedValue={suggestion?.dept ?? null}
          aria-label={`${deptLabel} — ${type}`}
        />
      </div>
      <div className="pm-cell" data-label={accLabel}>
        <CustomSearchSelect
          value={value.acc}
          onChange={val => onChange('acc', val)}
          options={acctOptions}
          notice={acctNotice}
          placeholder={accPlaceholder}
          hasError={status === 'invalid'}
          topChoice={accTopChoice?.code ? accTopChoice : null}
          suggestedValue={suggestion?.acc ?? null}
          aria-label={`${accLabel} — ${type}`}
        />
      </div>
      <div className="pm-actions">
        {suggestion && onAccept && onReject && (
          <div className="pm-suggest" role="group" aria-label={`${acceptLabel} / ${dismissLabel}`}>
            <button
              type="button"
              className="pm-accept-btn"
              onClick={onAccept}
              aria-label={`${acceptLabel} — ${type}`}
            >
              <Check size={13} aria-hidden="true" />
              {acceptLabel}
            </button>
            <button
              type="button"
              className="pm-dismiss-btn"
              onClick={onReject}
              aria-label={`${dismissLabel} — ${type}`}
            >
              {dismissLabel}
            </button>
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            className="pm-row-remove"
            onClick={onRemove}
            title={removeLabel}
            aria-label={removeLabel}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
