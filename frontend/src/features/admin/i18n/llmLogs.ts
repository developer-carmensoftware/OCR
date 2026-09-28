export const en = {
  'admin.llmLogs.title': 'LLM Logs',
  'admin.llmLogs.searchPlaceholder': 'Search model, module, task…',
  'admin.llmLogs.col.time': 'Time',
  'admin.llmLogs.col.tenant': 'Tenant',
  'admin.llmLogs.col.module': 'Module',
  'admin.llmLogs.col.model': 'Model',
  'admin.llmLogs.col.tokens': 'Tokens',
  'admin.llmLogs.col.duration': 'Duration (ms)',
  'admin.llmLogs.col.cost': 'Cost (USD)',
  'admin.llmLogs.col.taskId': 'Task ID',
  'admin.llmLogs.empty': 'No LLM logs found',
  'admin.llmLogs.truncationNote':
    'Showing the most recent {limit} — narrow the tenant or time filter to see more.',
  'admin.llmLogs.toast.loadFailed': 'LLM logs: {error}',
} as const

export const th: Record<keyof typeof en, string> = {
  'admin.llmLogs.title': 'บันทึก LLM',
  'admin.llmLogs.searchPlaceholder': 'ค้นหาโมเดล โมดูล หรือรหัสงาน…',
  'admin.llmLogs.col.time': 'เวลา',
  'admin.llmLogs.col.tenant': ' Tenant ',
  'admin.llmLogs.col.module': 'โมดูล',
  'admin.llmLogs.col.model': 'โมเดล',
  'admin.llmLogs.col.tokens': 'โทเคน',
  'admin.llmLogs.col.duration': 'ระยะเวลา (มิลลิวินาที)',
  'admin.llmLogs.col.cost': 'ค่าใช้จ่าย (USD)',
  'admin.llmLogs.col.taskId': 'รหัสงาน',
  'admin.llmLogs.empty': 'ไม่พบบันทึก LLM',
  'admin.llmLogs.truncationNote':
    'แสดง {limit} รายการล่าสุด — ปรับตัวกรอง Tenant หรือช่วงเวลาเพื่อดูเพิ่มเติม',
  'admin.llmLogs.toast.loadFailed': 'บันทึก LLM: {error}',
}
