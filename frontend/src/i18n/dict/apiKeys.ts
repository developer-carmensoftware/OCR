export const en = {
  'apiKeys.title': 'API keys',
  'apiKeys.description':
    'Keys Carmen uses to push PMS data to us — one per business unit and PMS, sent as a Bearer token. Carmen generates them from each PMS setting.',

  'apiKeys.status.aria': 'Carmen PMS webhook status',
  'apiKeys.status.loading': 'Checking keys…',
  'apiKeys.status.unknown': "Couldn't load the key status",
  'apiKeys.status.none': 'No active keys',
  'apiKeys.status.noneMeta': "Carmen can't send PMS data yet",
  'apiKeys.status.keysOne': '1 active key',
  'apiKeys.status.keysOther': '{n} active keys',
  'apiKeys.status.noCalls': 'No calls yet',
  'apiKeys.status.lastCall': 'Last call: {ago}',
  'apiKeys.status.endpoint': 'Endpoint',
  'apiKeys.status.copyEndpoint': 'Copy endpoint URL',

  'apiKeys.filter.active': 'Active',
  'apiKeys.filter.all': 'All',
  'apiKeys.searchPlaceholder': 'Search name, prefix or PMS…',

  'apiKeys.col.name': 'Name',
  'apiKeys.col.bu': 'Business unit',
  'apiKeys.col.pms': 'PMS',
  'apiKeys.col.status': 'Status',
  'apiKeys.col.lastUsed': 'Last used',
  'apiKeys.col.created': 'Created',
  'apiKeys.col.actions': 'Actions',
  'apiKeys.noBu': 'No business unit',
  'apiKeys.state.active': 'Active',
  'apiKeys.state.revoked': 'Revoked',
  'apiKeys.never': 'Never',
  'apiKeys.revoke': 'Revoke',
  'apiKeys.revokeAria': 'Revoke {name}',
  'apiKeys.empty': 'No keys match these filters',
  'apiKeys.emptyTitle': 'No active API keys',
  'apiKeys.emptyDescription':
    'Carmen generates a key when a business unit sets up a PMS in Carmen, and sends it with every event.',

  'apiKeys.revokeDialog.title': 'Revoke API key',
  'apiKeys.revokeDialog.lede': "Calls with this key are refused immediately. This can't be undone.",
  'apiKeys.revokeDialog.key': 'Key',
  'apiKeys.revokeDialog.recent':
    "Still in use — last call: {ago}. Revoking stops this business unit's PMS events.",
  'apiKeys.revokeDialog.reason': 'Reason',
  'apiKeys.revokeDialog.optional': 'optional',
  'apiKeys.revokeDialog.reasonPlaceholder': 'e.g. Rotated to a new key',
  'apiKeys.revokeDialog.cancel': 'Cancel',
  'apiKeys.revokeDialog.submit': 'Revoke key',
  'apiKeys.revokeDialog.submitting': 'Revoking…',

  'apiKeys.toast.revoked': 'Key revoked',
  'apiKeys.toast.loadFailed': 'API keys: {error}',
} as const

export const th: Record<keyof typeof en, string> = {
  'apiKeys.title': 'API key',
  'apiKeys.description':
    'Key ที่ Carmen ใช้ส่งข้อมูล PMS เข้ามา — หนึ่ง key ต่อ business unit ต่อ PMS ส่งมาแบบ Bearer token โดย Carmen เป็นผู้สร้างจากหน้าตั้งค่า PMS แต่ละตัว',

  'apiKeys.status.aria': 'สถานะ PMS webhook ของ Carmen',
  'apiKeys.status.loading': 'กำลังตรวจสอบ key…',
  'apiKeys.status.unknown': 'โหลดสถานะ key ไม่สำเร็จ',
  'apiKeys.status.none': 'ยังไม่มี key ที่ใช้งานอยู่',
  'apiKeys.status.noneMeta': 'Carmen ยังส่งข้อมูล PMS เข้ามาไม่ได้',
  'apiKeys.status.keysOne': 'key ที่ใช้งานอยู่ 1 ตัว',
  'apiKeys.status.keysOther': 'key ที่ใช้งานอยู่ {n} ตัว',
  'apiKeys.status.noCalls': 'ยังไม่มีการเรียกเข้ามา',
  'apiKeys.status.lastCall': 'เรียกเข้ามาล่าสุด: {ago}',
  'apiKeys.status.endpoint': 'Endpoint',
  'apiKeys.status.copyEndpoint': 'คัดลอก endpoint URL',

  'apiKeys.filter.active': 'ใช้งานอยู่',
  'apiKeys.filter.all': 'ทั้งหมด',
  'apiKeys.searchPlaceholder': 'ค้นหาชื่อ prefix หรือ PMS…',

  'apiKeys.col.name': 'ชื่อ',
  'apiKeys.col.bu': 'Business unit',
  'apiKeys.col.pms': 'PMS',
  'apiKeys.col.status': 'สถานะ',
  'apiKeys.col.lastUsed': 'ใช้งานล่าสุด',
  'apiKeys.col.created': 'สร้างเมื่อ',
  'apiKeys.col.actions': 'การดำเนินการ',
  'apiKeys.noBu': 'ไม่มี business unit',
  'apiKeys.state.active': 'ใช้งานอยู่',
  'apiKeys.state.revoked': 'เพิกถอนแล้ว',
  'apiKeys.never': 'ยังไม่เคย',
  'apiKeys.revoke': 'เพิกถอน',
  'apiKeys.revokeAria': 'เพิกถอน {name}',
  'apiKeys.empty': 'ไม่มี key ที่ตรงกับตัวกรองนี้',
  'apiKeys.emptyTitle': 'ยังไม่มี API key ที่ใช้งานอยู่',
  'apiKeys.emptyDescription':
    'Carmen จะสร้าง key ให้เมื่อ business unit ตั้งค่า PMS ใน Carmen และแนบ key นี้มากับทุก event',

  'apiKeys.revokeDialog.title': 'เพิกถอน API key',
  'apiKeys.revokeDialog.lede': 'การเรียกด้วย key นี้จะถูกปฏิเสธทันที และย้อนกลับไม่ได้',
  'apiKeys.revokeDialog.key': 'Key',
  'apiKeys.revokeDialog.recent':
    'ยังมีการใช้งานอยู่ — เรียกล่าสุด: {ago} การเพิกถอนจะหยุด PMS event ของ business unit นี้',
  'apiKeys.revokeDialog.reason': 'เหตุผล',
  'apiKeys.revokeDialog.optional': 'ไม่บังคับ',
  'apiKeys.revokeDialog.reasonPlaceholder': 'เช่น เปลี่ยนไปใช้ key ใหม่แล้ว',
  'apiKeys.revokeDialog.cancel': 'ยกเลิก',
  'apiKeys.revokeDialog.submit': 'เพิกถอน key',
  'apiKeys.revokeDialog.submitting': 'กำลังเพิกถอน…',

  'apiKeys.toast.revoked': 'เพิกถอน key แล้ว',
  'apiKeys.toast.loadFailed': 'API key: {error}',
}
