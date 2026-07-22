// Department-scoped account codes (Carmen `DefaultAccount`).
// A department's DefaultAccount is a *stringified* JSON array:
//   "[]"                                  → all accounts allowed (wildcard)
//   "[{\"AccCode\":\"4010001\",...},...]" → only those AccCodes allowed

interface DeptLike {
  code: string
  allowedAccounts?: string[]
}

interface AccountLike {
  code: string
}

/** Parse Carmen's DefaultAccount value into a list of AccCodes. Empty/invalid ⇒ [] (wildcard). */
export function parseDefaultAccount(raw: unknown): string[] {
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map(e => (e && typeof e === 'object' ? (e as Record<string, unknown>).AccCode : undefined))
    .filter((c): c is string => typeof c === 'string' && c !== '')
}

/** Account options valid for a department. No dept chosen or wildcard ⇒ all accounts. */
export function allowedAccountsForDept<A extends AccountLike>(
  deptCode: string | null | undefined,
  departments: DeptLike[],
  accounts: A[]
): A[] {
  if (!deptCode) return accounts
  const dept = departments.find(d => d.code === deptCode)
  const allowed = dept?.allowedAccounts
  if (!allowed || allowed.length === 0) return accounts
  const set = new Set(allowed)
  return accounts.filter(a => set.has(a.code))
}

/**
 * Merge a suggestion into the current mapping. User-picked values win; a suggested
 * acc that the effective dept's DefaultAccount list forbids is dropped (mixed pairs
 * happen when the user picked a dept and the suggestion validated against its own).
 */
export function mergeSuggestion(
  cur: { dept?: string | null; acc?: string | null },
  sugg: { dept?: string | null; acc?: string | null },
  departments: DeptLike[]
): { dept: string; acc: string } {
  const dept = cur.dept || sugg.dept || ''
  const acc = cur.acc || (sugg.acc && isAccountAllowed(dept, sugg.acc, departments) ? sugg.acc : '')
  return { dept, acc }
}

/** Whether accCode may be posted under deptCode. Unknown dept or wildcard ⇒ true. */
export function isAccountAllowed(
  deptCode: string | null | undefined,
  accCode: string | null | undefined,
  departments: DeptLike[]
): boolean {
  if (!deptCode || !accCode) return true
  const allowed = departments.find(d => d.code === deptCode)?.allowedAccounts
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(accCode)
}
