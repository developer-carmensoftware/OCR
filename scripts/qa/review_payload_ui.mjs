// Review payloads encrypted at rest — the full-system E2E (browser → backend → Postgres → Carmen).
//
//   python scripts/qa/review_payload_e2e.py seed       # first: the rows this drives
//   node   scripts/qa/review_payload_ui.mjs
//   python scripts/qa/review_payload_e2e.py check      # E-02 again, after: what the table holds
//   python scripts/qa/review_payload_e2e.py clear
//
// E-03 queue lists every seeded document with figures out of the (decrypted) payload
// E-04 the BAY document's review dialog opens on its own data
// E-05 approve it, input tax unticked → posted (a REAL JV in Carmen dev), owes input tax,
//      settled with "Keyed in Carmen already" (no ACTX)
// E-06 reject the SCB document with a reason
// E-07 the settlement sample (SQL filter on the readable doc_type of an encrypted row)
// E-08 the plaintext row parked before encryption still lists and opens
// E-09 the backfill endpoint, dry run: counts the plaintext row, writes nothing
// E-10 the PMS day's review screen shows its rows; reject it
// E-12 the PMS day's queue row carries its line count and flags out of the payload
// E-13 a row encrypted under another key lists with no figures, opens, and can be rejected
// E-14 no uncaught error in the page through the whole run
// E-15 the corrections the wizard sends on submit, through the signed-in session
// E-16 a bug report with a screenshot (there is no UI for it, so its endpoint directly)
//      — `review_payload_e2e.py check` then proves both are stored as tokens
// C-01 (OLD_API_URL set) the backend from `main` — what a rollback serves — answers the
//      queue and a document with encrypted rows in the table: 200, never 500
//
// Needs, as env (defaults in brackets):
//   PLAYWRIGHT_CORE  path to a playwright-core package [the npx cache's]
//   CHROME_EXE       a Chromium binary [ms-playwright chromium-1223]
//   APP_URL          the frontend [http://localhost:3010], proxying /api to the BRANCH backend
//   API_URL          that backend, for the job-token call [http://localhost:8010]
//   OLD_API_URL      a backend run from `main` on the same database [unset: C-01 skipped]
// Reads CARMEN_AUTHORIZATION and INTERNAL_JOB_TOKEN from backend/.env. Signs in through the
// real SSO link (BU carmen). Screenshots go to .playwright-mcp/review-payload/.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, '.playwright-mcp/review-payload')
const APP = process.env.APP_URL || 'http://localhost:3010'
const API = process.env.API_URL || 'http://localhost:8010'
const OLD_API = process.env.OLD_API_URL
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

const ENV = fs.readFileSync(path.join(ROOT, 'backend/.env'), 'utf8')
const envVar = name => ENV.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()

const DOCS = {
  bay: 'E2E-BAY-ENC-01',
  scb: 'E2E-SCB-ENC-02',
  kbank: 'E2E-KB-ENC-03',
  legacy: 'E2E-BAY-LEGACY-04',
  foreign: 'E2E-BAY-FOREIGN-05',
}
const PMS_ROW = 'E2E-ENC · Daily' // the email rows' filenames say E2E-ENC too
const pageErrors = []

const results = []
function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? `  (${detail})` : ''}`)
}

let page
let token

async function api(method, url, body) {
  const res = await page.request.fetch(`${APP}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status(), body: await res.json().catch(() => null) }
}

async function activity() {
  const { body } = await api('GET', '/api/v1/credit-card/activity?filter=all&limit=100')
  return body?.data || []
}

const rowOf = (rows, docNo) => rows.find(r => r.doc_no === docNo)

async function openQueue() {
  await page.goto(`${APP}/#/CreditCardOCR`)
  await page.getByRole('tab', { name: /^Review/ }).waitFor({ timeout: 30000 })
}

/** Open a queue row's Review dialog, from the Review tab. */
async function openReview(text) {
  await openQueue()
  await page.getByRole('tab', { name: /^Review/ }).click()
  const row = page.getByRole('row').filter({ hasText: text })
  await row.getByRole('button', { name: 'Review' }).click()
  const dialog = page.getByRole('dialog').first()
  await dialog.waitFor({ timeout: 30000 })
  await page.waitForTimeout(2000) // the dialog reads Carmen's lists before it settles
  return dialog
}

const inputValues = dialog => dialog.locator('input').evaluateAll(els => els.map(e => e.value))

async function shot(name) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('lang', 'en'))
  page = await context.newPage()
  page.on('pageerror', err => pageErrors.push(String(err)))

  // Sign in the way a Carmen user does: the menu's SSO link.
  const sso = new URLSearchParams({
    token: envVar('CARMEN_AUTHORIZATION'),
    bu: 'carmen',
    uri: 'https://dev.carmen4.com',
  })
  await page.goto(`${APP}/#/CreditCardOCR?${sso}`)
  await page.getByRole('tab', { name: /^Review/ }).waitFor({ timeout: 60000 })
  token = await page.evaluate(() => sessionStorage.getItem('ocr_access_token'))
  if (!token) throw new Error('SSO exchange left no session token')

  // ── E-03 the queue, built from decrypted payloads ──────────────────────────
  let rows = await activity()
  const bay = rowOf(rows, DOCS.bay)
  const kb = rowOf(rows, DOCS.kbank)
  const legacy = rowOf(rows, DOCS.legacy)
  check('E-03', 'BAY listed with its gross and lines', bay?.total === 15000 && bay?.line_count === 2,
    `total=${bay?.total} lines=${bay?.line_count}`)
  check('E-03', 'settlement report listed with its lines', kb?.line_count === 2, `lines=${kb?.line_count}`)
  check('E-03', 'plaintext row listed the same way', legacy?.total === 3000, `total=${legacy?.total}`)
  check('E-03', 'SCB listed', Boolean(rowOf(rows, DOCS.scb)))
  const foreign = rowOf(rows, DOCS.foreign)
  check('E-13', 'another key\'s row lists, with no figures, instead of failing the queue',
    foreign?.status === 'pending_review' && foreign?.line_count === 0,
    `status=${foreign?.status} lines=${foreign?.line_count}`)

  // ── E-12 the PMS day's queue row ──────────────────────────────────────────
  const pms = rows.find(r => r.source === 'pms' && r.attachment === PMS_ROW)
  check('E-12', 'PMS row has its 2 lines and the missing-mapping flag on 729',
    pms?.line_count === 2 && pms?.flags?.includes('mapping_missing') && pms?.unmapped?.includes('729'),
    `lines=${pms?.line_count} flags=${pms?.flags} unmapped=${pms?.unmapped}`)

  // ── C-01 the backend from main, reading encrypted rows ────────────────────
  if (!OLD_API) {
    console.log('SKIP C-01 (no OLD_API_URL)')
  } else {
    const old = (url) => fetch(`${OLD_API}${url}`, { headers: { Authorization: `Bearer ${token}` } })
    const queue = await old('/api/v1/credit-card/activity?filter=all&limit=100')
    const oldRows = (await queue.json().catch(() => ({}))).data || []
    const oldBay = rowOf(oldRows, DOCS.bay)
    check('C-01', 'old backend: queue answers 200 with the encrypted rows in it',
      queue.status === 200 && Boolean(oldBay), `HTTP ${queue.status}`)
    check('C-01', 'old backend: encrypted row degrades to no figures (not a 500)',
      oldBay?.line_count === 0, `lines=${oldBay?.line_count}`)
    check('C-01', 'old backend: the plaintext row still reads in full',
      rowOf(oldRows, DOCS.legacy)?.line_count === 1)
    const doc = await old(`/api/v1/email/documents/${oldBay?.id}`)
    check('C-01', 'old backend: an encrypted document opens 200', doc.status === 200, `HTTP ${doc.status}`)
    const list = await old('/api/v1/email/documents?limit=100')
    check('C-01', 'old backend: the review list answers 200', list.status === 200, `HTTP ${list.status}`)
  }

  await openQueue()
  await page.getByRole('tab', { name: /^Review/ }).click()
  await page.getByRole('row').filter({ hasText: DOCS.bay }).waitFor()
  await shot('E-03-queue')

  // ── E-04 the BAY review dialog ─────────────────────────────────────────────
  let dialog = await openReview(DOCS.bay)
  let values = await inputValues(dialog)
  check('E-04', 'dialog shows the document number', values.includes(DOCS.bay))
  // The payment types are the JV rows' comments — fields, so read as values, not text.
  check('E-04', 'dialog shows the payment types as JV rows',
    values.includes('VS INTER NON-PREM') && values.includes('VS INTER PREM'))
  check('E-04', 'credits are the payload\'s amounts, balanced',
    values.includes('10,000.00') && values.includes('5,000.00') &&
      (await dialog.innerText()).includes('Balanced'))
  const approve = dialog.getByRole('button', { name: 'Approve and post' })
  check('E-04', 'Approve is open (mapped, balanced)', await approve.isEnabled())
  await shot('E-04-bay-dialog')

  // ── E-05 approve with the input tax unticked ──────────────────────────────
  // E2E_NO_POST=1 on a rerun: every approve posts a real JV, and a second one for the same
  // seeded document number would be a duplicate in Carmen dev.
  if (process.env.E2E_NO_POST) {
    console.log('SKIP E-05 approve (E2E_NO_POST — a real JV was posted by an earlier run)')
  } else {
    await dialog.getByRole('checkbox', { name: 'Post the input tax record' }).uncheck()
    await approve.click()
    await page.getByRole('tab', { name: /^Review/ }).waitFor({ timeout: 60000 })
    await page.waitForTimeout(3000)
    rows = await activity()
    const posted = rowOf(rows, DOCS.bay)
    check('E-05', 'posted to Carmen with a JV number', posted?.status === 'posted' && posted?.jv_no,
      `status=${posted?.status} jv=${posted?.jv_no}`)
    check('E-05', 'owes its input tax (CA-111 still holds)', posted?.input_tax_owed === true && posted?.card_id)
    const keyed = await api('POST', `/api/v1/credit-card/activity/${posted?.card_id}/input-tax/keyed`)
    check('E-05', 'settled as keyed in Carmen (no ACTX)', keyed.status === 204, `HTTP ${keyed.status}`)
  }

  // ── E-06 reject the SCB document ──────────────────────────────────────────
  dialog = await openReview(DOCS.scb)
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await page.getByLabel('Reason (optional)').fill('E2E encryption test')
  await page.getByRole('button', { name: 'Reject document' }).click()
  await page.getByRole('tab', { name: /^Review/ }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(2000)
  const rejected = rowOf(await activity(), DOCS.scb)
  check('E-06', 'rejected with the reason', rejected?.status === 'rejected' &&
    (rejected?.error_message || '').includes('E2E encryption test'), `status=${rejected?.status}`)

  // ── E-07 the settlement sample reads an encrypted row by its doc_type ─────
  const sample = await api('GET', '/api/v1/ar-reconcile/sample-payment-types?bank_code=KBANK')
  const codes = (sample.body || []).map(r => r.payment_type_code)
  check('E-07', 'settlement sample = the seeded report\'s payment types',
    codes.includes('VS INTER PREM') && codes.includes('MC INTER NON-PREM'), codes.join(', '))

  // ── E-08 the plaintext row still opens ────────────────────────────────────
  dialog = await openReview(DOCS.legacy)
  values = await inputValues(dialog)
  check('E-08', 'plaintext row opens on its own data', values.includes(DOCS.legacy))
  await shot('E-08-legacy-dialog')

  // ── E-15 / E-16 corrections and a bug report, through the session ─────────
  const corr = await api('POST', '/api/v1/feedback/corrections', {
    corrections: [
      { doc_no: 'E2E-ENC-CORR-01', bank_code: 'KBANK', field_name: 'merchant_id',
        original_value: '451005282039001', corrected_value: '451005282039009' },
      { doc_no: 'E2E-ENC-CORR-01', bank_code: 'KBANK', field_name: 'branch_no',
        original_value: '', corrected_value: '00002' },
    ],
  })
  check('E-15', 'the wizard\'s corrections are saved', corr.status === 200 && corr.body?.saved === 2,
    `HTTP ${corr.status} saved=${corr.body?.saved}`)
  const png = fs.readFileSync(path.join(SHOTS, 'E-04-bay-dialog.png')).toString('base64')
  const bug = await api('POST', '/api/v1/feedback/bug-report', {
    module: 'credit_card_ocr', category: 'bug', description: 'E2E-ENC screenshot',
    screenshot_b64: png, screenshot_mime: 'image/png',
  })
  check('E-16', 'a bug report with a real screenshot is accepted', bug.status === 201,
    `HTTP ${bug.status} ${Math.round(png.length / 1024)} KB`)

  // ── E-09 the backfill endpoint, dry run ───────────────────────────────────
  const dry = await fetch(`${API}/api/v1/admin/encryption/backfill?dry_run=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${envVar('INTERNAL_JOB_TOKEN')}` },
  })
  const dryBody = await dry.json().catch(() => ({}))
  const found = dryBody.plaintext_rows || {}
  check('E-09', 'dry run counts the plaintext rows and writes nothing',
    dry.status === 200 && dryBody.status === 'dry_run' && found['email_documents.review_payload'] >= 1 &&
      found['correction_feedback.corrected_value'] >= 0 && 'bug_reports.screenshot_b64' in found,
    JSON.stringify(found))
  const anonymous = await fetch(`${API}/api/v1/admin/encryption/backfill?dry_run=true`, { method: 'POST' })
  const refused = anonymous.status
  check('E-09', 'refused without the job token / admin', refused === 401, `HTTP ${refused}`)

  // ── E-13 another key's row: opens, and can be put away ────────────────────
  const before = pageErrors.length
  dialog = await openReview(DOCS.foreign)
  check('E-13', 'its dialog opens without a page error', await dialog.isVisible() && pageErrors.length === before,
    pageErrors.slice(before).join(' | '))
  await shot('E-13-foreign-dialog')
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await page.getByLabel('Reason (optional)').fill('E2E unreadable payload')
  await page.getByRole('button', { name: 'Reject document' }).click()
  await page.getByRole('tab', { name: /^Review/ }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(2000)
  check('E-13', 'and can be rejected', rowOf(await activity(), DOCS.foreign)?.status === 'rejected')

  // ── E-10 the PMS day ──────────────────────────────────────────────────────
  dialog = await openReview(PMS_ROW)
  const text = await dialog.innerText()
  check('E-10', 'PMS review shows the day\'s rows', text.includes('Room Revenue') && text.includes('Breakfast'))
  await shot('E-10-pms-dialog')
  await dialog.getByRole('button', { name: 'Reject' }).click()
  await page.getByRole('button', { name: 'Reject day' }).click()
  await page.getByRole('tab', { name: /^Review/ }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(2000)
  const day = (await activity()).find(r => r.source === 'pms' && r.attachment === PMS_ROW)
  check('E-10', 'PMS day rejected', day?.status === 'rejected', `status=${day?.status}`)

  check('E-14', 'no uncaught page error through the run', pageErrors.length === 0, pageErrors.join(' | '))
  await browser.close()
}

try {
  await main()
} catch (err) {
  console.error(err)
  if (page) await shot('failure').catch(() => {})
  results.push({ id: 'E-xx', name: String(err), ok: false })
}
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
