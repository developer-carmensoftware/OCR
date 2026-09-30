import type { FieldMapping } from '@/shared/types/api'
import type {
  AddError,
  MappingItem,
  MappingSet,
} from '@/features/credit-card/components/payment-mapping/types'
import type { ActiveScan } from './useMapping'
import type { Suggestion } from './useMappingSuggestions'
import type { SettlementMappingHook } from './useSettlementMapping'

/**
 * A bank's payment-type vocabularies, as the sets the mapping dialog renders.
 *
 * The one place that knows which JV builders a bank has: the fee invoice's list always
 * exists (every bank has a statement or fee-invoice layout), and a bank with a settlement
 * layout adds the settlement report's list for the post type in use. The dialog gets the
 * result and nothing else. A future document type is one more producer below; a server
 * endpoint that returns sets would replace this function without touching the dialog.
 *
 * One code lives in one set. Settlement keys are owned by `useSettlementMapping`
 * (`useMapping` no longer loads them into the fee list), and any code that appears in
 * both anyway — a legacy key saved before settlement rows were tagged — is shown in the
 * settlement set only, because that is the one whose save re-tags it.
 */

export interface FeeInvoiceSource {
  activeScan: ActiveScan
  paymentAmount: Record<string, FieldMapping>
  customPaymentTypes: string[]
  paymentSuggestions: Record<string, Suggestion | null>
  paymentSuggestLoading: boolean
  handlePaymentMappingChange: (type: string, field: keyof FieldMapping, value: string) => void
  applyPaymentMappings: (codes: string[], patch: { dept?: string; acc?: string }) => void
  addPaymentType: (raw: string, taken: Set<string>) => AddError
  handleRemoveCustomType: (type: string) => void
  autoSuggestPaymentTypes: (types?: string[] | null) => Promise<void>
  confirmPaymentSuggestion: (type: string) => void
  rejectPaymentSuggestion: (type: string) => void
  openAmountModal: () => void
  cancelAmountSelection: () => void
  saveAmountSelection: () => void
}

export interface MappingSetsInput {
  fee: FeeInvoiceSource
  /** Null for a bank with no settlement layout (or while that hook is still loading). */
  settlement: SettlementMappingHook | null
  labels: { feeInvoice: string; settlement: string }
}

export interface MappingSets {
  sets: MappingSet[]
  /** The dialog edits a draft of every set at once. */
  open: () => void
  cancel: () => void
  done: () => void
}

export function buildMappingSets({ fee, settlement, labels }: MappingSetsInput): MappingSets {
  const settlementCodes = new Set(settlement ? Object.keys(settlement.mappingsToSave) : [])

  const scanned = fee.activeScan.paymentTypes
  const feeCodes = [
    ...scanned,
    ...fee.customPaymentTypes.filter(code => !scanned.has(code)),
  ].filter(code => !settlementCodes.has(code))
  const feeCodeSet = new Set(feeCodes)

  const feeItems: MappingItem[] = feeCodes.map(code => ({
    code,
    mapping: fee.paymentAmount[code] || { dept: '', acc: '' },
    suggestion: fee.paymentSuggestions[code] ?? null,
    onDocument: scanned.has(code),
    // A scanned type comes back with the next scan; only one the BU typed can go.
    removable: fee.customPaymentTypes.includes(code) && !scanned.has(code),
  }))

  const feeSet: MappingSet = {
    id: 'fee_invoice',
    label: labels.feeInvoice,
    items: feeItems,
    setField: (code, field, value) => fee.handlePaymentMappingChange(code, field, value),
    applyToMany: fee.applyPaymentMappings,
    add: raw => fee.addPaymentType(raw, settlementCodes),
    remove: fee.handleRemoveCustomType,
    suggest: () => void fee.autoSuggestPaymentTypes(feeCodes),
    suggesting: fee.paymentSuggestLoading,
    accept: fee.confirmPaymentSuggestion,
    reject: fee.rejectPaymentSuggestion,
    acceptAll: () =>
      feeItems.filter(i => i.suggestion).forEach(i => fee.confirmPaymentSuggestion(i.code)),
  }

  const sets: MappingSet[] = []
  if (settlement) {
    sets.push({
      id: `settlement_${settlement.postType.toLowerCase()}`,
      label: labels.settlement,
      items: settlement.rows.map(row => ({
        code: row.code,
        mapping: row.mapping,
        suggestion: settlement.suggestions[row.code] ?? null,
        removable: true,
      })),
      setField: settlement.setRowMapping,
      applyToMany: settlement.applyToMany,
      add: raw => settlement.addCustomType(raw, feeCodeSet),
      remove: settlement.removeType,
      suggest: () => void settlement.runSuggest(),
      suggesting: settlement.suggestLoading,
      accept: settlement.acceptSuggestion,
      reject: settlement.rejectSuggestion,
      acceptAll: settlement.acceptAllSuggestions,
    })
  }
  // A settlement bank lists its fee-invoice types only when it has some; every other bank
  // always gets the list, empty or not, since it is the only one it has.
  if (!settlement || feeItems.length > 0) sets.push(feeSet)

  return {
    sets,
    open: () => {
      fee.openAmountModal()
      settlement?.snapshot()
    },
    cancel: () => {
      fee.cancelAmountSelection()
      settlement?.restore()
    },
    done: () => {
      fee.saveAmountSelection()
      settlement?.dropSnapshot()
    },
  }
}
