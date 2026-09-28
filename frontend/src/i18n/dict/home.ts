export const en = {
  // — Home / module picker —
  'home.subtitle':
    'AI-powered accounting automation — extract invoices and credit card statements, then post directly to Carmen Cloud with no manual entry.',
  'home.tagActive': 'ACTIVE',
  'home.tagSoon': 'COMING SOON',
  // Same name as the page it opens, and a sentence about the destination rather than about
  // the wizard one level below it. Home is the only screen that still sells this — the
  // queue itself does not — so it is the one that has to describe the automation.
  'home.ccName': 'AI JV Automation',
  'home.ccDesc':
    'Forward credit card statements by email — AI reads them, maps the GL, and queues them for approval before they post to Carmen Cloud',
  'home.apName': 'AP Invoice Processing',
  'home.apDesc':
    'Reads vendor invoices automatically, matches GL accounts, and syncs with the accounting system',
  'home.bankName': 'Bank Reconciliation',
  'home.bankDesc':
    'Automatically compares bank statements against ledger entries to flag discrepancies',
  'home.plansDesc': 'Buy documents or upgrade your plan',
  'home.plansCta': 'View plans',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Home / module picker —
  'home.subtitle':
    'ระบบอัตโนมัติด้านบัญชีด้วย AI — ดึงข้อมูลใบแจ้งหนี้และรายการบัตรเครดิต แล้วบันทึกเข้า Carmen Cloud โดยตรงไม่ต้องคีย์มือ',
  'home.tagActive': 'พร้อมใช้งาน',
  'home.tagSoon': 'เร็ว ๆ นี้',
  'home.ccName': 'AI JV Automation',
  'home.ccDesc':
    'ส่งอีเมล statement บัตรเครดิตเข้ามา AI อ่านและจับคู่ผังบัญชีให้ แล้วรอการอนุมัติก่อนลงบัญชีเข้า Carmen Cloud',
  'home.apName': 'ประมวลผลใบแจ้งหนี้เจ้าหนี้ (AP)',
  'home.apDesc': 'อ่านใบแจ้งหนี้ผู้ขายอัตโนมัติ จับคู่บัญชี GL และซิงค์กับระบบบัญชี',
  'home.bankName': 'กระทบยอดธนาคาร',
  'home.bankDesc':
    'เปรียบเทียบรายการเดินบัญชีธนาคารกับสมุดบัญชีอัตโนมัติเพื่อตรวจหาความคลาดเคลื่อน',
  'home.plansDesc': 'ซื้อเอกสารเพิ่มหรืออัปเกรดแพ็กเกจ',
  'home.plansCta': 'ดูแพ็กเกจ',
}
