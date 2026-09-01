/**
 * What to call an accounting-config field type in front of a person.
 *
 * The config keys `commission`, `tax` and `net` are storage names; everything else in the
 * map is a payment type the document itself named, which is already readable. The queue's
 * reason line and the mapping table both have to say which rule they mean, and two copies
 * of this list is how they end up disagreeing.
 */
const FIXED: Record<string, string> = {
  commission: 'Credit card commission',
  tax: 'Input Tax',
  net: 'Bank Account',
}

export function glFieldLabel(key: string): string {
  return FIXED[key] || key
}

/** A comma-joined list, capped so one row of a table cannot be pushed off screen by a
 *  statement with fifteen payment types. The caller keeps the full list for the tooltip. */
export function glFieldList(keys: string[], max = 3): string {
  const named = keys.map(glFieldLabel)
  if (named.length <= max) return named.join(', ')
  return `${named.slice(0, max).join(', ')} +${named.length - max}`
}
