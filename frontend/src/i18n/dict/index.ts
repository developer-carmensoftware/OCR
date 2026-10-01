/**
 * Bilingual (EN/TH) UI copy, one file per key namespace: `checkout.*` lives in
 * `./checkout.ts`, and so on. Each file exports `en` (the source of truth) and `th`, typed
 * `Record<keyof typeof en, string>` so a missing Thai string is a compile error in the file
 * that is missing it. Tier brand names (Free/Starter/Standard/…) are NOT here — they read
 * as product names and stay in `features/billing/constants.ts`.
 *
 * The admin dashboard's keys (`admin.*`) are not in this file's DICT when the app loads.
 * They live in `features/admin/i18n/` and are added by `registerDict()` when the admin
 * chunk loads (`AdminRouter.tsx`, `OrderReviewShell.tsx`) — which keeps them out of the
 * customer bundle. `TKey` still covers them, through a type-only import that erases.
 *
 * `{var}` placeholders are filled by `t(key, vars)` in LanguageContext.
 */

import type { AdminKey } from '@/features/admin/i18n'
import * as nav from './nav'
import * as tutorial from './tutorial'
import * as pricing from './pricing'
import * as plan from './plan'
import * as pack from './pack'
import * as contact from './contact'
import * as checkout from './checkout'
import * as qr from './qr'
import * as slip from './slip'
import * as order from './order'
import * as proforma from './proforma'
import * as usage from './usage'
import * as quota from './quota'
import * as flows from './flows'
import * as modal from './modal'
import * as orev from './orev'
import * as ap from './ap'
import * as ar from './ar'
import * as cc from './cc'
import * as warn from './warn'
import * as common from './common'
import * as notif from './notif'
import * as review from './review'
import * as whatsnew from './whatsnew'
import * as home from './home'
import * as maintenance from './maintenance'

export type Lang = 'en' | 'th'

const en = {
  ...nav.en,
  ...tutorial.en,
  ...pricing.en,
  ...plan.en,
  ...pack.en,
  ...contact.en,
  ...checkout.en,
  ...qr.en,
  ...slip.en,
  ...order.en,
  ...proforma.en,
  ...usage.en,
  ...quota.en,
  ...flows.en,
  ...modal.en,
  ...orev.en,
  ...ap.en,
  ...ar.en,
  ...cc.en,
  ...warn.en,
  ...common.en,
  ...notif.en,
  ...review.en,
  ...whatsnew.en,
  ...home.en,
  ...maintenance.en,
}

const th = {
  ...nav.th,
  ...tutorial.th,
  ...pricing.th,
  ...plan.th,
  ...pack.th,
  ...contact.th,
  ...checkout.th,
  ...qr.th,
  ...slip.th,
  ...order.th,
  ...proforma.th,
  ...usage.th,
  ...quota.th,
  ...flows.th,
  ...modal.th,
  ...orev.th,
  ...ap.th,
  ...ar.th,
  ...cc.th,
  ...warn.th,
  ...common.th,
  ...notif.th,
  ...review.th,
  ...whatsnew.th,
  ...home.th,
  ...maintenance.th,
}

export type TKey = keyof typeof en | AdminKey

// Typed over every key, admin's included, although admin's arrive only with
// `registerDict` — `translate` already falls back to the key itself for a missing one.
export const DICT: Record<Lang, Record<TKey, string>> = {
  en: { ...en } as Record<TKey, string>,
  th: { ...th } as Record<TKey, string>,
}

/** Merge a lazily loaded set of keys (the admin dashboard's) into DICT. Idempotent. */
export function registerDict(extra: {
  en: Record<string, string>
  th: Record<string, string>
}): void {
  Object.assign(DICT.en, extra.en)
  Object.assign(DICT.th, extra.th)
}

/** Pure lookup: current lang → en fallback → key; fills `{var}` placeholders. */
export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
