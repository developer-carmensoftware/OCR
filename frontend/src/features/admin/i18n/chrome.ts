export const en = {
  // — Admin dashboard (bilingual EN/TH — nav, KPIs, tables, forms, toasts) —
  'admin.chrome.skipLink': 'Skip to main content',
  'admin.chrome.navAria': 'Admin navigation',
  'admin.chrome.roleFallback': 'admin',
  'admin.chrome.logout': 'Logout',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Admin dashboard (bilingual EN/TH — nav, KPIs, tables, forms, toasts) —
  'admin.chrome.skipLink': 'ข้ามไปเนื้อหาหลัก',
  'admin.chrome.navAria': 'เมนูนำทางแอดมิน',
  'admin.chrome.roleFallback': 'แอดมิน',
  'admin.chrome.logout': 'ออกจากระบบ',
}
