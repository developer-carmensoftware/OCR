export const en = {
  // — Header credit badge (the entry point into pricing) —
  // "Buy", not "Top up": #/pricing sells subscription plans as well as one-time
  // credit packs, and "top up" names only the packs. The coin icon beside it
  // carries "credits", so the word only has to carry the verb.
  'quota.credit': 'Credit',
  'quota.buy': 'Buy',
  // Commas, not dashes: screen readers handle them more predictably.
  'quota.aria': '{n} credits remaining, open plans and credits',
  'quota.ariaNoCount': 'Open plans and credits',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Header credit badge (the entry point into pricing) —
  'quota.credit': 'เครดิต',
  'quota.buy': 'ซื้อ',
  'quota.aria': 'เหลือ {n} เครดิต เปิดหน้าแพ็กเกจและเครดิต',
  'quota.ariaNoCount': 'เปิดหน้าแพ็กเกจและเครดิต',
}
