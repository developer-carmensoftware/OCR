/**
 * Constants barrel export
 * Re-exports everything from sub-modules for backward compatibility.
 * New code should import directly from the specific module:
 *   import { BANKS } from './constants/banks'
 *   import { DETAIL_COLUMNS } from './constants/fields'
 */

export { BANK_THAI_NAMES, detectBankFromCompanyName, detectBankFromExtracted, BANKS } from './banks'
export { DETAIL_COLUMNS, HEADER_LABELS, DETAIL_LABELS, EMPTY_DETAIL_ROW } from './fields'
