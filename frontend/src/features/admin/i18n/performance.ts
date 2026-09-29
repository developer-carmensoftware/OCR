export const en = {
  'admin.performance.title': 'Performance Logs',
  'admin.performance.searchPlaceholder': 'Search endpoint or user…',
  'admin.performance.minDurationAria': 'Minimum duration in milliseconds',
  'admin.performance.minDurationPlaceholder': 'Min ms (e.g. 1000)',
  'admin.performance.col.time': 'Time',
  'admin.performance.col.method': 'Method',
  'admin.performance.col.endpoint': 'Endpoint',
  'admin.performance.col.status': 'Status',
  'admin.performance.col.duration': 'Duration (ms)',
  'admin.performance.col.tenant': 'Tenant',
  'admin.performance.empty': 'No performance logs',
  'admin.performance.toast.loadFailed': 'Performance: {error}',
} as const

export const th: Record<keyof typeof en, string> = {
  'admin.performance.title': 'บันทึกประสิทธิภาพ',
  'admin.performance.searchPlaceholder': 'ค้นหา endpoint หรือผู้ใช้…',
  'admin.performance.minDurationAria': 'ระยะเวลาขั้นต่ำ (มิลลิวินาที)',
  'admin.performance.minDurationPlaceholder': 'มิลลิวินาทีขั้นต่ำ (เช่น 1000)',
  'admin.performance.col.time': 'เวลา',
  'admin.performance.col.method': 'เมธอด',
  'admin.performance.col.endpoint': 'เอนด์พอยต์',
  'admin.performance.col.status': 'สถานะ',
  'admin.performance.col.duration': 'ระยะเวลา (มิลลิวินาที)',
  'admin.performance.col.tenant': ' Tenant ',
  'admin.performance.empty': 'ไม่มีบันทึกประสิทธิภาพ',
  'admin.performance.toast.loadFailed': 'ประสิทธิภาพ: {error}',
}
