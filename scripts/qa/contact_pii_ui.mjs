// A contact person's details encrypted at rest — the full-system E2E on the LOCAL stack
// (browser → branch backend → local Supabase Postgres, with the widening migration applied).
//
//   npx supabase start …  &&  npx supabase db reset          # see contact_pii_e2e.py
//   backend on 8011 against it, vite on 3011 proxied to 8011
//   node scripts/qa/contact_pii_ui.mjs
//
// C-1 sign in through the real SSO link (BU carmen; the exchange creates its tenant locally)
// C-2 checkout in the browser with a Thai purchaser name, phone and email → an order whose
//     proforma comes back with them, and whose table row holds only tokens
// C-3 cancel it; the checkout prefill reads the last proforma's contact back (if Carmen sends
//     no company profile — when it does, that source wins and this is reported, not failed)
// C-4 email settings page: save your email addresses → the page reloads them; the row holds
//     a token
// C-5 admin API: the order's documents carry the decrypted contact; the tenant detail shows a
//     contact email written in plaintext the old way (`contact_pii_e2e.py legacy`)
// C-6 the backfill: dry run counts those plaintext values, apply encrypts them, and the admin
//     API still shows them; `check` then finds nothing but tokens
// C-7 no uncaught page error
//
// Env (defaults in brackets): PLAYWRIGHT_CORE, CHROME_EXE [as review_payload_ui.mjs],
// APP_URL [http://localhost:3011], API_URL [http://localhost:8011].
// Reads CARMEN_AUTHORIZATION and INTERNAL_JOB_TOKEN from backend/.env.

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, '.playwright-mcp/contact-pii')
const APP = process.env.APP_URL || 'http://localhost:3011'
const API = process.env.API_URL || 'http://localhost:8011'
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

const ENV = fs.readFileSync(path.join(ROOT, 'backend/.env'), 'utf8')
const envVar = name => ENV.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
const PY = path.join(ROOT, 'backend/venv/Scripts/python.exe')
const helper = (...args) =>
  execFileSync(PY, [path.join(ROOT, 'scripts/qa/contact_pii_e2e.py'), ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

const CONTACT = 'คุณสมหญิง ใจดี (ฝ่ายบัญชี)'
const TEL = '02-123-4567 ต่อ 1234'
const EMAIL = 'somying.accounting@example.co.th'
// One address unique to the run: saving what is already saved leaves Save disabled.
const OWNERS = ['accounting@example.co.th', `run-${Date.now()}@example.co.th`]

const results = []
function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? `  (${detail})` : ''}`)
}

let page
let token
const pageErrors = []

async function api(method, url, body, auth = `Bearer ${token}`) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function shot(name) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
}

/** A new tenant meets the consent gate first; it opens once the server says there is no record. */
async function acceptConsent() {
  const confirm = page.locator('.uc-confirm-btn')
  const shown = await confirm.waitFor({ timeout: 10000 }).then(() => true, () => false)
  if (shown) {
    await page.locator('.uc-check-row input[type="checkbox"]').check()
    await confirm.click()
    await page.locator('.uc-overlay').waitFor({ state: 'detached', timeout: 15000 })
  }
}

const field = label => page.locator('label.checkout-field', { hasText: label }).locator('input')

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'en')
    } catch {} // a document with no storage of its own
  })
  page = await context.newPage()
  page.on('pageerror', err => pageErrors.push(String(err)))
  const sso = new URLSearchParams({ token: envVar('CARMEN_AUTHORIZATION'), bu: 'carmen', uri: 'https://dev.carmen4.com' })

  // ── C-1 sign in ───────────────────────────────────────────────────────────
  await page.goto(`${APP}/#/CreditCardOCR?${sso}`)
  await page.waitForFunction(() => sessionStorage.getItem('ocr_access_token'), null, { timeout: 60000 })
  token = await page.evaluate(() => sessionStorage.getItem('ocr_access_token'))
  await acceptConsent()
  check('C-1', 'signed in through the SSO link', Boolean(token))

  // ── C-2 checkout ──────────────────────────────────────────────────────────
  await page.goto(`${APP}/#/pricing`)
  await acceptConsent()
  await page.locator('.plan-cta:not([disabled])').first().click()
  await field('Company / buyer name').waitFor({ timeout: 30000 })
  await field('Company / buyer name').fill('บริษัท ทดสอบการเข้ารหัส จำกัด')
  await field('Tax ID').fill('0105536000127')
  await field('Branch').fill('00000')
  await field('Address').fill('99 ถนนสุขุมวิท กรุงเทพมหานคร 10110')
  await field('Purchaser name').fill(CONTACT)
  await field('Tel.').fill(TEL)
  await field('Email').fill(EMAIL)
  await shot('C-2-checkout-form')
  await page.getByRole('button', { name: 'Continue to payment' }).first().click()
  const again = page.getByRole('dialog').getByRole('button', { name: 'Continue to payment' })
  if (await again.isVisible({ timeout: 3000 }).catch(() => false)) await again.click()
  await page.getByText('Confirm payment').first().waitFor({ timeout: 30000 })
  await shot('C-2-payment-step')

  const orders = (await api('GET', '/api/v1/credits/orders?limit=5')).body?.data || []
  const order = orders[0]
  const docs = (await api('GET', `/api/v1/credits/orders/${order?.id}/documents`)).body || []
  const proforma = docs.find(d => d.doc_type === 'proforma')
  check('C-2', 'the order\'s proforma comes back with the purchaser exactly as typed',
    proforma?.buyer_contact_name === CONTACT && proforma?.buyer_tel === TEL && proforma?.buyer_email === EMAIL,
    `${proforma?.buyer_contact_name} | ${proforma?.buyer_tel} | ${proforma?.buyer_email}`)

  // C-5, first half — before C-3 cancels the order (a cancelled order is soft-deleted, and the
  // admin endpoint answers 404 for it).
  const admin = `Bearer ${helper('admin-jwt').trim()}`
  const adminDocs = (await api('GET', `/api/v1/admin/credit-orders/${order?.id}/documents`, null, admin)).body || []
  check('C-5', 'admin sees the order\'s purchaser decrypted',
    adminDocs[0]?.buyer_contact_name === CONTACT && adminDocs[0]?.buyer_email === EMAIL,
    `${adminDocs[0]?.buyer_contact_name} | ${adminDocs[0]?.buyer_email}`)

  // ── C-3 the prefill reads the last proforma back ──────────────────────────
  const cancel = await api('POST', `/api/v1/credits/orders/${order?.id}/cancel`)
  const prefill = (await api('GET', '/api/v1/credits/company-profile')).body || {}
  if (prefill.source === 'last_invoice') {
    check('C-3', 'checkout prefill carries the decrypted purchaser',
      prefill.contact_name === CONTACT && prefill.tel === TEL, `${prefill.contact_name} | ${prefill.tel}`)
  } else {
    console.log(`NOTE C-3 prefill came from "${prefill.source}" (Carmen's company profile wins), cancel HTTP ${cancel.status}`)
  }

  // ── C-4 the email settings page ───────────────────────────────────────────
  const settingsUrl = `${APP}/#/CreditCardOCR/email-settings?${sso}`
  await page.goto(settingsUrl)
  await acceptConsent()
  const owners = page.locator('#email-owner-emails')
  await owners.waitFor({ timeout: 60000 })
  await owners.fill(OWNERS.join(', '))
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText('Settings saved').first().waitFor({ timeout: 30000 })
  await page.reload() // a full load: the field is filled from the server, not from the draft
  await owners.waitFor({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('#email-owner-emails')?.value, null, { timeout: 30000 })
  const reloaded = (await owners.inputValue()).split(/[,\s]+/).filter(Boolean)
  check('C-4', 'your email addresses save and reload', JSON.stringify(reloaded) === JSON.stringify(OWNERS),
    reloaded.join(', '))
  await shot('C-4-email-settings')

  // ── C-5 the admin API, on a contact written before encryption ─────────────
  const legacy = JSON.parse(helper('legacy'))
  const tenantBefore = (await api('GET', `/api/v1/admin/tenants/${legacy.tenant_id}`, null, admin)).body
  check('C-5', 'admin reads a contact email still in plaintext (from before)',
    tenantBefore?.contact_email === 'ops.legacy@example.co.th', tenantBefore?.contact_email)

  // ── C-6 the backfill ──────────────────────────────────────────────────────
  const job = `Bearer ${envVar('INTERNAL_JOB_TOKEN')}`
  const dry = (await api('POST', '/api/v1/admin/encryption/backfill?dry_run=true', null, job)).body || {}
  const found = dry.plaintext_rows || {}
  check('C-6', 'dry run counts the plaintext contact values, and C-2/C-4\'s writes are not among them',
    found['tenants.contact_email'] === 1 && found['billing_documents.buyer_contact_name'] === 1 &&
      found['billing_documents.buyer_email'] === 1 && found['email_ingest_settings.owner_emails'] === 0,
    JSON.stringify(found))
  const applied = (await api('POST', '/api/v1/admin/encryption/backfill', null, job)).body || {}
  check('C-6', 'apply encrypts them', applied.status === 'completed', JSON.stringify(applied.plaintext_rows))
  const tenantAfter = (await api('GET', `/api/v1/admin/tenants/${legacy.tenant_id}`, null, admin)).body
  const legacyDocs = (await api('GET', `/api/v1/admin/credit-orders/${legacy.legacy_order}/documents`, null, admin)).body || []
  check('C-6', 'and the admin API reads the same values back',
    tenantAfter?.contact_email === 'ops.legacy@example.co.th' && legacyDocs[0]?.buyer_tel === '0899999999')
  let raw = ''
  let rawOk = true
  try {
    raw = helper('check')
  } catch (err) {
    rawOk = false
    raw = String(err.stdout || err)
  }
  console.log(raw.trimEnd())
  check('C-6', 'every contact value of the BU is now a token our key opens', rawOk)

  check('C-7', 'no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
  await browser.close()
}

try {
  await main()
} catch (err) {
  console.error(err)
  if (page) await shot('failure').catch(() => {})
  results.push({ id: 'C-xx', name: String(err), ok: false })
}
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
