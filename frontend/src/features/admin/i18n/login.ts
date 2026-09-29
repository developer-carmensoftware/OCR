export const en = {
  // Neutral wording on purpose: both system admins and order reviewers sign in here.
  'admin.login.title': 'Sign in',
  'admin.login.subtitle': 'Carmen AI Platform access for staff accounts',
  'admin.login.username': 'Username',
  'admin.login.password': 'Password',
  'admin.login.showPassword': 'Show password',
  'admin.login.hidePassword': 'Hide password',
  'admin.login.capsLock': 'Caps Lock is on',
  'admin.login.signingIn': 'Signing in…',
  'admin.login.signIn': 'Sign in',
  'admin.login.failed': 'Login failed',
  // Keyed off HTTP status, not the backend's English string. 403 covers both
  // "disabled" and "no roles": different causes, same thing for you to do.
  'admin.login.error.invalid': 'Incorrect username or password.',
  'admin.login.error.locked': 'Too many failed attempts. Try again in {time}.',
  'admin.login.error.lockedNoTime': 'Too many failed attempts. This account is temporarily locked.',
  'admin.login.error.noAccess':
    'This account cannot sign in. Ask a system administrator to check it.',
  'admin.login.error.network': 'Cannot reach the server. Check your connection and try again.',
  'admin.login.error.generic': 'Sign-in failed. Please try again.',
} as const

export const th: Record<keyof typeof en, string> = {
  'admin.login.title': 'เข้าสู่ระบบ',
  'admin.login.subtitle': 'สำหรับบัญชีเจ้าหน้าที่ Carmen AI Platform',
  'admin.login.username': 'ชื่อผู้ใช้',
  'admin.login.password': 'รหัสผ่าน',
  'admin.login.showPassword': 'แสดงรหัสผ่าน',
  'admin.login.hidePassword': 'ซ่อนรหัสผ่าน',
  'admin.login.capsLock': 'Caps Lock เปิดอยู่',
  'admin.login.signingIn': 'กำลังเข้าสู่ระบบ…',
  'admin.login.signIn': 'เข้าสู่ระบบ',
  'admin.login.failed': 'เข้าสู่ระบบไม่สำเร็จ',
  'admin.login.error.invalid': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  'admin.login.error.locked': 'ใส่รหัสผ่านผิดหลายครั้ง ลองใหม่ได้ในอีก {time}',
  'admin.login.error.lockedNoTime': 'ใส่รหัสผ่านผิดหลายครั้ง บัญชีนี้ถูกล็อกชั่วคราว',
  'admin.login.error.noAccess': 'บัญชีนี้เข้าสู่ระบบไม่ได้ กรุณาแจ้งผู้ดูแลระบบให้ตรวจสอบ',
  'admin.login.error.network': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่',
  'admin.login.error.generic': 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
}
