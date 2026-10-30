// The frontend's security headers, served the way Vercel serves them, against every screen.
//
//   npx vite build --mode e2e --outDir <dir>          # mode e2e: no .env.production, so the
//                                                     # app calls /api on its own origin
//   npx vite preview --config <scratch config> --outDir <dir>
//       the config spreads frontend/vite.config.ts, sets preview.port 3011, preview.headers to
//       vercel.json's headers, and proxies /api to the branch backend on 8010
//   node scripts/qa/security_headers_ui.mjs
//
// H-1 the page is served with the enforced headers (X-Frame-Options DENY, nosniff,
//     Referrer-Policy, HSTS) and the CSP
// H-2 every screen loads without one CSP violation — the CSP is Report-Only, so a violation
//     blocks nothing yet; this is the list that has to be empty before it is enforced
//     (`securitypolicyviolation` events, report and enforce dispositions alike)
// H-3 the page refuses to be framed
// H-4 the violation listener works: a script the CSP does not allow is reported (otherwise
//     H-2's zero would prove nothing)
//
// Screens: Home, the queue, a review dialog (if BU carmen has a pending document), the manual
// scan with a PDF preview (blob: iframe), AP invoice with a PDF preview, mapping, email
// settings, pricing → checkout form (no order created), order history, what's new, and the
// admin dashboard's read-only pages (a read-only admin token minted from backend/.env).
//
// Env: PLAYWRIGHT_CORE, CHROME_EXE [as review_payload_ui.mjs], APP_URL [http://localhost:3011],
// DOCS_DIR [~/Desktop/demo-mock-docs] (scb_card_report.pdf, ap_tax_invoice.pdf).

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, '.playwright-mcp/security-headers')
const APP = process.env.APP_URL || 'http://localhost:3011'
const DOCS = process.env.DOCS_DIR || path.join(os.homedir(), 'Desktop/demo-mock-docs')
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

const ENV = fs.readFileSync(path.join(ROOT, 'backend/.env'), 'utf8')
const envVar = name => ENV.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
const READ_ONLY_PERMS = [
  'admin_users:read', 'alerts:read', 'api_keys:read', 'configs:read',
  'orders:read', 'quotas:read', 'roles:read', 'tenants:read',
]

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
    `print(create_admin_jwt("e2e-admin", "e2e", ["e2e"], ${JSON.stringify(READ_ONLY_PERMS)}, get_admin_jwt_secret(), ttl_hours=1))`,
  ].join('\n')
  const out = execFileSync(path.join(ROOT, 'backend/venv/Scripts/python.exe'), ['-c', code], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  })
  return out.trim().split('\n').pop() // the token is the last line, whatever config printed
}

/** Was the admin page itself rendered, or the sign-in form in its place? */
async function signedInAsAdmin() {
  return !(await page.getByRole('button', { name: 'Sign in' }).isVisible().catch(() => false))
}

let page
const violations = [] // { screen, directive, blocked, disposition }
let screen = 'start'

async function visit(name, hash, after) {
  screen = name
  const before = violations.length
  await page.goto(`${APP}/${hash}`)
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  if (after) await after()
  await page.waitForTimeout(1500) // late images, fonts and frames
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {})
  const mine = violations.slice(before)
  console.log(`  ${name.padEnd(22)} ${mine.length ? mine.map(v => `${v.directive} ← ${v.blocked}`).join(' | ') : 'no violation'}`)
}

async function upload(file) {
  const input = page.locator('input[type="file"]').first()
  await input.setInputFiles(path.join(DOCS, file))
  await page.waitForTimeout(3000) // the preview builds a blob: URL and frames it
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'en')
    } catch {}
    document.addEventListener('securitypolicyviolation', e =>
      window.__csp_push?.({ directive: e.effectiveDirective, blocked: e.blockedURI, disposition: e.disposition }),
    )
  })
  await context.exposeFunction('__csp_push', v => violations.push({ screen, ...v }))
  // Choosing a file on the manual scan / AP pages starts an extraction straight away — a
  // real LLM call and a credit. Stop it in the browser: the screens load, nothing is read.
  await context.route(/\/api\/v1\/[^?]*\/extract/, route => route.abort())
  page = await context.newPage()

  // ── H-1 the headers on the document ───────────────────────────────────────
  const res = await page.goto(`${APP}/`)
  const h = res.headers()
  check('H-1', 'X-Frame-Options DENY', h['x-frame-options'] === 'DENY')
  check('H-1', 'nosniff, Referrer-Policy, HSTS, Permissions-Policy',
    h['x-content-type-options'] === 'nosniff' && h['referrer-policy'] === 'strict-origin-when-cross-origin' &&
      /max-age=\d+/.test(h['strict-transport-security'] || '') && Boolean(h['permissions-policy']))
  check('H-1', 'CSP served (Report-Only)', Boolean(h['content-security-policy-report-only']))

  // ── H-2 every screen ──────────────────────────────────────────────────────
  const sso = new URLSearchParams({ token: envVar('CARMEN_AUTHORIZATION'), bu: 'carmen', uri: 'https://dev.carmen4.com' })
  await visit('sso-queue', `#/CreditCardOCR?${sso}`, async () => {
    await page.waitForFunction(() => sessionStorage.getItem('ocr_access_token'), null, { timeout: 60000 })
  })
  await visit('home', '#/')
  await visit('queue', '#/CreditCardOCR', async () => {
    const review = page.getByRole('button', { name: 'Review' }).first()
    if (await review.isVisible({ timeout: 5000 }).catch(() => false)) {
      await review.click()
      await page.getByRole('dialog').first().waitFor({ timeout: 30000 }).catch(() => {})
    }
  })
  await visit('manual-scan-preview', '#/CreditCardOCR/manual', () => upload('scb_card_report.pdf'))
  await visit('ap-invoice-preview', '#/APInvoice', () => upload('ap_tax_invoice.pdf'))
  await visit('mapping', '#/CreditCardOCR/mapping')
  await visit('email-settings', `#/CreditCardOCR/email-settings?${sso}`)
  await visit('pricing-checkout', '#/pricing', async () => {
    await page.locator('.plan-cta:not([disabled])').first().click().catch(() => {})
    await page.waitForTimeout(2000)
  })
  await visit('order-history', '#/pricing/orders')
  await visit('whats-new', '#/whats-new')

  // The admin auth context reads its token once, when the app loads — so a full reload, not
  // a hash change, after putting it there.
  await page.evaluate(t => sessionStorage.setItem('ocr_admin_token', t), adminToken())
  await page.goto(`${APP}/#/admin`)
  await page.reload()
  const notRendered = []
  for (const p of ['', '/tenants', '/credit-orders', '/extractions', '/usage', '/jobs', '/email', '/api-keys']) {
    await visit(`admin${p.replace('/', '-') || '-overview'}`, `#/admin${p}`)
    if (!(await signedInAsAdmin())) notRendered.push(p || '/')
  }
  check('H-2', 'every admin page rendered signed in (not the sign-in form)', notRendered.length === 0,
    notRendered.join(', '))

  check('H-2', 'no CSP violation on any screen', violations.length === 0,
    violations.map(v => `${v.screen}: ${v.directive} ← ${v.blocked} (${v.disposition})`).join(' | '))

  // ── H-4 the listener hears a violation (else H-2's zero proves nothing) ───
  screen = 'probe'
  await page.goto(`${APP}/#/`)
  await page.evaluate(() => {
    const s = document.createElement('script')
    s.textContent = 'window.__probe = 1' // inline, not in the CSP's hashes
    document.head.appendChild(s)
  })
  await page.waitForTimeout(1000)
  check('H-4', 'an inline script the CSP does not allow is reported',
    violations.some(v => v.screen === 'probe' && v.directive.startsWith('script-src')))

  // ── H-3 framing ───────────────────────────────────────────────────────────
  // X-Frame-Options is enforced now (frame-ancestors waits with the rest of the CSP).
  await page.setContent(`<iframe id="f" src="${APP}/"></iframe>`)
  await page.waitForTimeout(3000)
  const framed = await page.frames().find(f => f.url().startsWith(APP))?.evaluate(() => document.title).catch(() => null)
  check('H-3', 'the app refuses to render inside a frame', !framed, framed ? `rendered: ${framed}` : 'blocked')

  await browser.close()
}

try {
  await main()
} catch (err) {
  console.error(err)
  results.push({ id: 'H-xx', name: String(err), ok: false })
}
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
