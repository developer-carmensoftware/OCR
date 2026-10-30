// Retention (decision-log #50) through the app, on the LOCAL stack.
//
//   npx supabase start … && npx supabase db reset      (migrations 20261030000100/200)
//   backend on 8011 against it, vite on 3011 proxied to 8011
//   node scripts/qa/retention_ui.mjs
//
// R-1 a 13-month-old scan, scrubbed: the queue's All tab still lists it, as "scrubbed", with
//     its JV — the row survives, only the filename is gone
// R-2 the admin Credits ledger shows the old charge (amount and balance intact, no filename)
// R-3 the mailbox purge endpoint answers a dry run with the job token (the real mailbox in
//     backend/.env, counted only — nothing moves), and refuses without it
// R-4 no uncaught page error
//
// Env: PLAYWRIGHT_CORE, CHROME_EXE [as review_payload_ui.mjs], APP_URL [http://localhost:3011],
// API_URL [http://localhost:8011].

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, '.playwright-mcp/retention')
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
const run = (args, opts = {}) =>
  execFileSync(PY, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts })
const lastLine = out => out.trim().split('\n').pop()

const results = []
function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? `  (${detail})` : ''}`)
}

function adminToken() {
  const code = [
    'import sys; sys.path.insert(0, "backend")',
    'from app.auth.admin_session import create_admin_jwt',
    'from app.services.admin.auth import get_admin_jwt_secret',
    // quotas:read is what the Credits page's balance and ledger endpoints ask for.
    'print(create_admin_jwt("e2e-admin", "e2e", ["e2e"], ["tenants:read", "orders:read", "quotas:read"], get_admin_jwt_secret(), ttl_hours=1))',
  ].join('\n')
  return lastLine(run(['-c', code]))
}

let page
const pageErrors = []

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'en')
    } catch {}
  })
  page = await context.newPage()
  page.on('pageerror', err => pageErrors.push(String(err)))

  // Sign in (the exchange creates BU carmen's tenant in the local DB), accept the consent gate.
  const sso = new URLSearchParams({ token: envVar('CARMEN_AUTHORIZATION'), bu: 'carmen', uri: 'https://dev.carmen4.com' })
  await page.goto(`${APP}/#/CreditCardOCR?${sso}`)
  await page.waitForFunction(() => sessionStorage.getItem('ocr_access_token'), null, { timeout: 60000 })
  const consent = page.locator('.uc-confirm-btn')
  if (await consent.waitFor({ timeout: 10000 }).then(() => true, () => false)) {
    await page.locator('.uc-check-row input[type="checkbox"]').check()
    await consent.click()
  }
  const seeded = JSON.parse(lastLine(run([path.join(ROOT, 'scripts/qa/retention_e2e.py'), 'seed'])))

  // ── R-1 the queue's All tab ───────────────────────────────────────────────
  await page.goto(`${APP}/#/CreditCardOCR`)
  await page.reload()
  await page.getByRole('tab', { name: /^All/ }).click()
  const row = page.getByRole('row').filter({ hasText: 'E2E-RET-OLD' })
  const listed = await row.waitFor({ timeout: 30000 }).then(() => true, () => false)
  const text = listed ? await row.innerText() : ''
  check('R-1', 'the old scan is still listed, as "scrubbed", with its JV',
    listed && text.includes('scrubbed') && !text.includes('somchai'), text.replace(/\s+/g, ' ').slice(0, 120))
  await page.screenshot({ path: path.join(SHOTS, 'R-1-queue-all.png') })

  // ── R-2 the admin Credits ledger ──────────────────────────────────────────
  await page.evaluate(t => sessionStorage.setItem('ocr_admin_token', t), adminToken())
  const today = new Date().toISOString().slice(0, 10)
  await page.goto(`${APP}/#/admin/credits?tenant_id=${seeded.tenant_id}&from=2024-01-01&to=${today}`)
  await page.reload()
  const ledger = await page.getByRole('row').filter({ hasText: '29' }).first()
    .waitFor({ timeout: 30000 }).then(() => true, () => false)
  const body = await page.locator('body').innerText()
  check('R-2', 'the ledger still shows the old charge, without its filename',
    ledger && !body.includes('statement_somchai'), ledger ? 'row with balance 29 found' : 'row not found')
  await page.screenshot({ path: path.join(SHOTS, 'R-2-admin-ledger.png') })

  // ── R-3 the purge endpoint, dry run only ──────────────────────────────────
  const dry = await fetch(`${API}/api/v1/carmen/email-ingest/purge?dry_run=true`, {
    method: 'POST', headers: { Authorization: `Bearer ${envVar('INTERNAL_JOB_TOKEN')}` },
  })
  const dryBody = await dry.json().catch(() => ({}))
  check('R-3', 'a dry run counts the mail past the window and moves nothing',
    dry.status === 200 && dryBody.status === 'dry_run' && Number.isInteger(dryBody.messages),
    JSON.stringify(dryBody))
  const refused = (await fetch(`${API}/api/v1/carmen/email-ingest/purge?dry_run=true`, { method: 'POST' })).status
  check('R-3', 'refused without the job token', refused === 401, `HTTP ${refused}`)

  check('R-4', 'no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
  await browser.close()
}

try {
  await main()
} catch (err) {
  console.error(err)
  results.push({ id: 'R-xx', name: String(err), ok: false })
}
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
