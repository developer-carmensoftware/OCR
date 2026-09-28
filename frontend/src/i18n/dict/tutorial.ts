export const en = {
  // — Tutorial modal — chrome shared by every module's tour. The narration
  //   itself lives in content/tutorials/.
  'tutorial.title': 'How to buy a package',
  'tutorial.stepOf': 'Step {n} / {total}',
  'tutorial.prev': 'Back',
  'tutorial.next': 'Next',
  'tutorial.done': 'Done',
  'tutorial.close': 'Close tutorial',
  'tutorial.calm': 'Calm',
  'tutorial.calmHint': 'Turn off the zoom between steps',
  'tutorial.buyPackage': 'Buy a package',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Tutorial modal —
  'tutorial.title': 'คู่มือการซื้อแพ็กเกจ',
  'tutorial.stepOf': 'ขั้นตอนที่ {n} / {total}',
  'tutorial.prev': 'ย้อนกลับ',
  'tutorial.next': 'ถัดไป',
  'tutorial.done': 'เสร็จสิ้น',
  'tutorial.close': 'ปิดคู่มือ',
  'tutorial.calm': 'ลดการเคลื่อนไหว',
  'tutorial.calmHint': 'ปิดการซูมระหว่างเปลี่ยนขั้นตอน',
  'tutorial.buyPackage': 'ซื้อ Package',
}
