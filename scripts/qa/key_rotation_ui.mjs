// Key rotation (docs/KEY_ROTATION.md) through the app, on the LOCAL stack, one phase at a time.
//
//   MODE=prepare   node scripts/qa/key_rotation_ui.mjs   # sign in, place an order; saves STATE
//   MODE=verify EXPECT=readable|unreadable node scripts/qa/key_rotation_ui.mjs
//
// The backend is restarted between phases with different keys; this script only looks. It
// reuses the session saved by `prepare`, so the session's Carmen token stays the one written
// under the first key — which is what a rotation has to carry over.
//
// K-1 the session still works (its Carmen token decrypts on every request)
// K-2 the queue lists the pending document with its 2 lines, and its refused-sender message
// K-3 the order's proforma comes back with its purchaser
// K-4 the email settings return their owner addresses (Carmen-token auth, not the session)
// K-5 Carmen answers through the session's token (company profile)
// K-6 the review dialog opens on the document, in the browser
// EXPECT=unreadable inverts the claim: under a key that cannot open the data, K-1 must fail
// (500 "Session data corrupted") and K-4 must come back without the addresses.
//
// Env: STATE [scratch json], APP_URL [http://localhost:3011], API_URL [http://localhost:8011],
// PLAYWRIGHT_CORE, CHROME_EXE as review_payload_ui.mjs.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const APP = process.env.APP_URL || 'http://localhost:3011'
const API = process.env.API_URL || 'http://localhost:8011'
const MODE = process.env.MODE || 'verify'
const EXPECT = process.env.EXPECT || 'readable'
const STATE = process.env.STATE || path.join(os.tmpdir(), 'key_rotation_state.json')
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

const ENV = fs.readFileSync(path.join(ROOT, 'backend/.env'), 'utf8')
const envVar = name => ENV.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
const CONTACT = 'คุณวิภา หมุนกุญแจ'
const DOC_NO = 'E2E-ROT-01'
const CARMEN = { uri: 'https://dev.carmen4.com', bu: 'carmen' }

const results = []
function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? `  (${detail})` : ''}`)
}

async function call(method, url, { token, auth, body } = {}) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: auth ?? `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function prepare() {
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  const page = await browser.newPage()
  const sso = new URLSearchParams({ token: envVar('CARMEN_AUTHORIZATION'), ...CARMEN })
  await page.goto(`${APP}/#/CreditCardOCR?${sso}`)
  await page.waitForFunction(() => sessionStorage.getItem('ocr_access_token'), null, { timeout: 60000 })
  const token = await page.evaluate(() => sessionStorage.getItem('ocr_access_token'))
  // Everything the SSO exchange left in sessionStorage — the shell wants more than the JWT
  // to count as signed in — so `verify` can come back as this same session.
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  await browser.close()
  const order = await call('POST', '/api/v1/credits/orders', {
    token,
    body: {
      pack_code: 'pack_small',
      buyer: { name: 'บริษัท หมุนกุญแจ จำกัด', tax_id: '0105536000127', branch: '00000',
        address: '1 ถนนพระราม 4 กรุงเทพฯ', contact_name: CONTACT, tel: '02-555-0100', email: 'rotate@example.co.th' },
    },
  })
  let orderId = order.body?.order?.id ?? order.body?.id
  if (order.status === 409) {
    // One open order per BU: an earlier `prepare` left this one, with the same purchaser.
    const list = await call('GET', '/api/v1/credits/orders?limit=20', { token })
    orderId = (list.body?.data || []).find(o => o.status === 'in_progress')?.id
  }
  check('P-1', 'signed in, with an open order', Boolean(token) && Boolean(orderId), `HTTP ${order.status}`)
  fs.writeFileSync(STATE, JSON.stringify({ token, storage, order: orderId }))
}

async function verify() {
  const { token, storage, order } = JSON.parse(fs.readFileSync(STATE, 'utf8'))
  const readable = EXPECT === 'readable'

  const activity = await call('GET', '/api/v1/credit-card/activity?filter=all&limit=100', { token })
  if (!readable) {
    check('K-1', 'the session no longer decrypts under a key that never wrote it',
      activity.status === 500, `HTTP ${activity.status}`)
  } else {
    check('K-1', 'the session still works', activity.status === 200, `HTTP ${activity.status}`)
    const row = (activity.body?.data || []).find(r => r.doc_no === DOC_NO)
    check('K-2', 'the pending document lists with its 2 lines and its refused-sender message',
      row?.line_count === 2 && (row?.error_message || '').includes('ap@exampel.co.th'),
      `lines=${row?.line_count} error=${(row?.error_message || '').slice(-30)}`)
    const docs = await call('GET', `/api/v1/credits/orders/${order}/documents`, { token })
    check('K-3', 'the proforma comes back with its purchaser',
      docs.body?.[0]?.buyer_contact_name === CONTACT, docs.body?.[0]?.buyer_contact_name)
    const profile = await call('GET', '/api/v1/credits/company-profile', { token })
    check('K-5', 'Carmen answers through the session\'s token', profile.status === 200, `HTTP ${profile.status}`)
  }

  const q = new URLSearchParams(CARMEN)
  const settings = await call('GET', `/api/v1/carmen/settings?${q}`, { auth: envVar('CARMEN_AUTHORIZATION') })
  const owners = settings.body?.owner_emails || []
  check('K-4', readable ? 'the email settings return their owner addresses' : 'the owner addresses do not read under that key',
    readable ? owners.length > 0 : owners.length === 0, `HTTP ${settings.status} ${JSON.stringify(owners)}`)

  if (readable) {
    const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
    const page = await browser.newPage()
    await page.addInitScript(saved => {
      for (const [k, v] of Object.entries(saved)) sessionStorage.setItem(k, v)
      try {
        localStorage.setItem('lang', 'en')
      } catch {}
    }, storage)
    await page.goto(`${APP}/#/CreditCardOCR`)
    await page.getByRole('row').filter({ hasText: DOC_NO }).getByRole('button', { name: 'Review' }).click({ timeout: 30000 })
    const dialog = page.getByRole('dialog').first()
    await dialog.waitFor({ timeout: 30000 })
    await page.waitForTimeout(1500)
    const values = await dialog.locator('input').evaluateAll(els => els.map(e => e.value))
    check('K-6', 'the review dialog opens on the document', values.includes(DOC_NO))
    await browser.close()
  }
}

try {
  await (MODE === 'prepare' ? prepare() : verify())
} catch (err) {
  console.error(err)
  results.push({ id: 'K-xx', name: String(err), ok: false })
}
const failed = results.filter(r => !r.ok)
console.log(`\n${MODE}/${EXPECT}: ${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
