/**
 * AP Invoice hooks — facade pattern.
 *
 * Pages should import from this barrel: `import { useAPInvoice } from 'hooks/ap-invoice'`
 * Subhooks (useAPExtraction, useAPSubmission, useAPValidation, useAPVendor) are wired
 * together inside useAPInvoice — do not import them directly from pages.
 */

export { useAPInvoice } from './useAPInvoice'
export type { APLineItem } from './useAPExtraction'
