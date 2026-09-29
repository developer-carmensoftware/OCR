import type { TKey } from '@/i18n/dict'

/**
 * What to call an accounting-config field type in front of a person.
 *
 * The config keys `commission`, `tax` and `net` are storage names; everything else in the
 * map is a payment type the document itself named, which is already readable. The queue's
 * reason line and the mapping table both have to say which rule they mean, and two copies
 * of this list is how they end up disagreeing.
 *
 * Takes `t` rather than importing it, because these are called from components and from a
 * hook, and a translate function is not something a plain module can hold — passing it in
 * is what keeps this the only copy of the list now that it is bilingual.
 */
const FIXED: Record<string, TKey> = {
  commission: 'cc.glCommission',
  tax: 'cc.glTax',
  net: 'cc.glNet',
}

type Translate = (key: TKey) => string

export function glFieldLabel(key: string, t: Translate): string {
  const fixed = FIXED[key]
  return fixed ? t(fixed) : key
}

/** A comma-joined list, capped so one row of a table cannot be pushed off screen by a
 *  statement with fifteen payment types. The caller keeps the full list for the tooltip. */
export function glFieldList(keys: string[], t: Translate, max = 3): string {
  const named = keys.map(k => glFieldLabel(k, t))
  if (named.length <= max) return named.join(', ')
  return `${named.slice(0, max).join(', ')} +${named.length - max}`
}
