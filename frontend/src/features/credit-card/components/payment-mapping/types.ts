import { isAccountAllowed } from '@/shared/lib/deptAccounts'
import type { FieldMapping } from '@/shared/types/api'
import type { MasterDepartment } from '@/features/credit-card/hooks/mapping/useMappingData'
import type { Suggestion } from '@/features/credit-card/hooks/mapping/useMappingSuggestions'

/**
 * The payment-type mapping model, with no bank in it.
 *
 * A *set* is one vocabulary of payment types that one JV builder reads: the fee invoice's
 * printed transaction names, or a settlement report's Detail or Summary keys. The dialog
 * renders whatever sets it is handed and knows nothing about which bank or document
 * produced them — `useMappingSets` is where a bank's capabilities turn into sets. A new
 * document type is a new producer there; a server-driven list of sets later would only
 * replace that hook.
 */

export type MappingStatus = 'invalid' | 'needs' | 'suggested' | 'mapped'

export interface MappingItem {
  /** The key saved in `bu_accounting_mapping_entries.field_type`. */
  code: string
  mapping: FieldMapping
  suggestion?: Suggestion | null
  /** Printed on a document we are holding right now (the wizard's scan). */
  onDocument?: boolean
  /** The BU added it (or the set allows removing any row). */
  removable?: boolean
}

/** Why an add was refused, or null when it went in. */
export type AddError = 'blank' | 'duplicate' | null

export interface MappingSet {
  id: string
  /** Already translated, e.g. "Fee invoice", "Settlement report · Summary". */
  label: string
  items: MappingItem[]
  setField: (code: string, field: 'dept' | 'acc', value: string) => void
  /** One write for many rows — bulk apply. Only the fields present are written. */
  applyToMany: (codes: string[], patch: { dept?: string; acc?: string }) => void
  add?: (code: string) => AddError
  remove?: (code: string) => void
  suggest: () => void
  suggesting: boolean
  accept: (code: string) => void
  reject: (code: string) => void
  acceptAll: () => void
}

export function statusOf(item: MappingItem, departments: MasterDepartment[]): MappingStatus {
  const { dept, acc } = item.mapping
  if (dept && acc && !isAccountAllowed(dept, acc, departments)) return 'invalid'
  if (item.suggestion && (item.suggestion.dept || item.suggestion.acc)) return 'suggested'
  if (!dept || !acc) return 'needs'
  return 'mapped'
}

/** Posts cleanly: both codes set and the pair legal. The counter and progress read this. */
export const isMapped = (item: MappingItem, departments: MasterDepartment[]) =>
  Boolean(item.mapping.dept && item.mapping.acc) && statusOf(item, departments) !== 'invalid'

export interface SetStats {
  total: number
  mapped: number
  /** needs + invalid + suggested — what the "Needs mapping" filter shows. */
  attention: number
  invalid: number
  suggested: number
}

export function statsOf(set: MappingSet, departments: MasterDepartment[]): SetStats {
  const s: SetStats = { total: set.items.length, mapped: 0, attention: 0, invalid: 0, suggested: 0 }
  for (const item of set.items) {
    const st = statusOf(item, departments)
    if (isMapped(item, departments)) s.mapped++
    if (st !== 'mapped') s.attention++
    if (st === 'invalid') s.invalid++
    if (st === 'suggested') s.suggested++
  }
  return s
}

/** Worst first, so the rows that need a person are at the top when the dialog opens. */
export const STATUS_RANK: Record<MappingStatus, number> = {
  invalid: 0,
  needs: 1,
  suggested: 2,
  mapped: 3,
}
