// Domain types for AP Invoice shared across hooks, lib utilities, and components.
// Centralised here so lib/ utilities (apGroup, apTax) do not need to import from hooks/.

export interface APLineItem {
  category?: string
  description?: string
  qty?: string
  unitPrice?: string
  discountPct?: string
  discountAmt?: string
  lineSubTotal?: string
  taxPct?: string
  taxType?: string
  taxAmt?: string
  lineTotal?: string
  taxProfileCode1?: string
  deptCode?: string
  accountCode?: string
  _suggestDept?: string
  _suggestAcc?: string
  // Transient flags — never sent to Carmen (buildInvoicePayload uses an explicit key list).
  // _uid: stable per-row identity assigned at extraction; preserved through edits and undo.
  // _groupId: present only on grouped rows; key into the groupSources map in useAPInvoice.
  // _taxProfileTouched: set when the user manually edits Tax Profile/Tax%/Type so auto-match skips it.
  _uid?: string
  _groupId?: string
  _taxProfileTouched?: string
  [key: string]: string | undefined
}
