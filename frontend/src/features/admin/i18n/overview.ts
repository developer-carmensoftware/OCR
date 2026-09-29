export const en = {
  'admin.overview.description':
    'Usage, cost, and health across your tenants over the selected period.',
  'admin.overview.title': 'Overview',
  'admin.overview.kpi.llmCalls': 'LLM Calls',
  'admin.overview.kpi.cost': 'Cost',
  'admin.overview.kpi.errorRate': 'Error Rate',
  'admin.overview.kpi.openAlerts': 'Open Alerts',
  'admin.overview.kpi.documents': 'Documents (MTD)',
  'admin.overview.kpi.submissions': 'Submissions (MTD)',
  'admin.overview.chart.dailyCost': 'Daily Cost (30 days)',
  'admin.overview.chart.dailyLlmCalls': 'Daily LLM Calls (30 days)',
  'admin.overview.series.costUsd': 'Cost USD',
  'admin.overview.series.llmCalls': 'LLM Calls',
  'admin.overview.toast.totalsFailed': 'Totals: {error}',
  'admin.overview.toast.trendFailed': 'Trend: {error}',
} as const

export const th: Record<keyof typeof en, string> = {
  'admin.overview.description':
    'การใช้งาน ค่าใช้จ่าย และสถานะระบบของ Tenant ทั้งหมดในช่วงเวลาที่เลือก',
  'admin.overview.title': 'ภาพรวม',
  'admin.overview.kpi.llmCalls': 'จำนวนการเรียก LLM',
  'admin.overview.kpi.cost': 'ค่าใช้จ่าย',
  'admin.overview.kpi.errorRate': 'อัตราข้อผิดพลาด',
  'admin.overview.kpi.openAlerts': 'การแจ้งเตือนที่ยังเปิดอยู่',
  'admin.overview.kpi.documents': 'เอกสาร (เดือนนี้)',
  'admin.overview.kpi.submissions': 'การส่งเข้าระบบ (เดือนนี้)',
  'admin.overview.chart.dailyCost': 'ค่าใช้จ่ายรายวัน (30 วัน)',
  'admin.overview.chart.dailyLlmCalls': 'จำนวนการเรียก LLM รายวัน (30 วัน)',
  'admin.overview.series.costUsd': 'ค่าใช้จ่าย (USD)',
  'admin.overview.series.llmCalls': 'จำนวนการเรียก LLM',
  'admin.overview.toast.totalsFailed': 'ยอดรวม: {error}',
  'admin.overview.toast.trendFailed': 'แนวโน้ม: {error}',
}
