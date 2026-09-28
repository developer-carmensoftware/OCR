export const en = {
  // — Plan cards —
  'plan.docsPerMonthSuffix': 'documents / month',
  'plan.perMonth': '/ month',
  'plan.perDoc': '/ doc',
  'plan.billingMonthly': 'Monthly',
  'plan.billingAnnual': 'Annual',
  'plan.saveAnnualPct': 'Save {pct}%',
  'plan.billedYearly': '฿{total} / yr',
  // Visible CTA text. The card's heading already names the tier, so the button
  // carries only the action; the {name} variants below become its accessible name.
  'plan.ctaChoose': 'Choose plan',
  'plan.ctaRenew': 'Renew plan',
  'plan.ctaChange': 'Change plan',
  'plan.choose': 'Choose {name}',
  'plan.renew': 'Renew {name}',
  'plan.change': 'Change to {name}',
  'plan.changeNote':
    'Switching now replaces your current plan — remaining documents and days are not carried over.',
  'plan.custom': 'Custom',
  'plan.contactSales': 'Contact sales',
  'plan.enterpriseTagline': 'For hotel groups',
  'plan.customPricing': 'usage-based pricing',
  'plan.badgePopular': 'Popular',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Plan cards —
  'plan.docsPerMonthSuffix': 'เอกสาร / เดือน',
  'plan.perMonth': '/ เดือน',
  'plan.perDoc': '/ เอกสาร',
  'plan.billingMonthly': 'รายเดือน',
  'plan.billingAnnual': 'รายปี',
  'plan.saveAnnualPct': 'ประหยัด {pct}%',
  'plan.billedYearly': '฿{total}/ปี',
  'plan.ctaChoose': 'เลือกแพ็กเกจ',
  'plan.ctaRenew': 'ต่ออายุแพ็กเกจ',
  'plan.ctaChange': 'เปลี่ยนแพ็กเกจ',
  'plan.choose': 'เลือก {name}',
  'plan.renew': 'ต่ออายุ {name}',
  'plan.change': 'เปลี่ยนเป็น {name}',
  'plan.changeNote':
    'การเปลี่ยนตอนนี้จะแทนที่แพ็กเกจปัจจุบัน — เอกสารและวันที่เหลืออยู่จะไม่ถูกยกยอด',
  'plan.custom': 'กำหนดเอง',
  'plan.contactSales': 'ติดต่อฝ่ายขาย',
  'plan.enterpriseTagline': 'สำหรับเครือโรงแรม',
  'plan.customPricing': 'คิดตามการใช้งาน',
  'plan.badgePopular': 'ยอดนิยม',
}
