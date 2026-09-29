export const en = {
  // — Public maintenance wall —
  'maintenance.title': 'Down for maintenance',
  'maintenance.body': "We're updating the system and will be back shortly. Your work is safe.",
  'maintenance.retry': 'Try again',
  'maintenance.backBy': 'Expected back by {time}',
  'maintenance.banner': 'Scheduled maintenance {start} – {end} · in {countdown}',
  'maintenance.bannerTitle': 'Scheduled maintenance',
  'maintenance.bannerIn': 'in {countdown}',
  'maintenance.dismiss': 'Dismiss',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Public maintenance wall —
  'maintenance.title': 'ปิดปรับปรุงระบบชั่วคราว',
  'maintenance.body': 'กำลังอัปเดตระบบ อีกสักครู่จะกลับมาใช้งานได้ ข้อมูลของคุณยังอยู่ครบ',
  'maintenance.retry': 'ลองใหม่',
  'maintenance.backBy': 'คาดว่าจะกลับมาราว {time}',
  'maintenance.banner': 'ระบบจะปิดปรับปรุง {start} – {end} · อีก {countdown}',
  'maintenance.bannerTitle': 'ระบบจะปิดปรับปรุง',
  'maintenance.bannerIn': 'อีก {countdown}',
  'maintenance.dismiss': 'ปิด',
}
