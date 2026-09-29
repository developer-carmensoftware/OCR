export const en = {
  // What's New — release history page (#/whats-new), entered from the bell.
  // The release copy itself is data in shared/content/releaseNotes.ts, not keys.
  'whatsnew.title': "What's new",
  'whatsnew.subtitle': 'Updates to Carmen AI Automation, newest first.',
  'whatsnew.new': 'New',
  'whatsnew.empty': 'No updates to show yet.',
  // Not plain "New" — that is the unread tag, and two different "New"s on the
  // same entry read as one thing.
  'whatsnew.cat.features': 'New features',
  'whatsnew.cat.fixes': 'Fixed',
  'whatsnew.cat.qol': 'Improved',
  'whatsnew.before': 'Before',
} as const

export const th: Record<keyof typeof en, string> = {
  'whatsnew.title': 'มีอะไรใหม่',
  'whatsnew.subtitle': 'การอัปเดตของ Carmen AI Automation เรียงจากล่าสุด',
  'whatsnew.new': 'ใหม่',
  'whatsnew.empty': 'ยังไม่มีการอัปเดตที่จะแสดง',
  'whatsnew.cat.features': 'ฟีเจอร์ใหม่',
  'whatsnew.cat.fixes': 'แก้ไขข้อผิดพลาด',
  'whatsnew.cat.qol': 'ปรับปรุงการใช้งาน',
  'whatsnew.before': 'ก่อนหน้านี้',
}
