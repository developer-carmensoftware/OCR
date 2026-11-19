export const en = {
  // Changelog dialog, opened from the bell's release row (ReleaseNotesDialog).
  // The release copy itself is data in shared/content/releaseNotes.ts, not keys.
  'whatsnew.title': 'Changelog',
  'whatsnew.bellRow': "What's new in {version}",
  'whatsnew.releaseDate': 'Release date {date}',
  'whatsnew.new': 'New',
  'whatsnew.empty': 'No updates to show yet.',
  'whatsnew.close': 'Close',
  // A baseline release (0.1.0) sums up the product: "New" would claim old features arrived that day.
  'whatsnew.cat.keyFeatures': 'Key Features',
  'whatsnew.cat.features': 'New Features',
  'whatsnew.cat.enhancements': 'Enhancements',
} as const

export const th: Record<keyof typeof en, string> = {
  'whatsnew.title': 'บันทึกการอัปเดต',
  'whatsnew.bellRow': 'มีอะไรใหม่ในเวอร์ชัน {version}',
  'whatsnew.releaseDate': 'วันที่เผยแพร่ {date}',
  'whatsnew.new': 'ใหม่',
  'whatsnew.empty': 'ยังไม่มีการอัปเดตที่จะแสดง',
  'whatsnew.close': 'ปิด',
  'whatsnew.cat.keyFeatures': 'ฟีเจอร์หลัก',
  'whatsnew.cat.features': 'ฟีเจอร์ใหม่',
  'whatsnew.cat.enhancements': 'การปรับปรุง',
}
