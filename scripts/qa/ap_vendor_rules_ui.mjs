// CA-123 — AP vendor reading rules through the real UI (Playwright).
//
//   node scripts/qa/ap_vendor_rules_ui.mjs U1 U2 U3 U4      # backend on the QA model
//   node scripts/qa/ap_vendor_rules_ui.mjs U5               # after restarting it on gemini-2.5
//   node scripts/qa/ap_vendor_rules_ui.mjs cleanup          # void what U1 posted (and 317)
//
// U1  Polar Bear's PDF, end to end. Step 3 must hold the PACK quantities and auto-match vendor
//     P20230002. The one real Carmen post goes through "Invoice Already Exists → Change Invoice
//     Number" (317 holds the number), then the invoice is read back from Carmen: Qty × Price =
//     Net and Total = Unpaid on every line.
// U2  The same invoice as a PNG — the image path. The post is intercepted and its payload checked.
// U3  The warning banner, from the real backend's output for the 10-19 misread
//     (`ap_vendor_rules_e2e.py fixture`): EN and TH copy, and Proceed not blocked by the warning.
// U4  A vendor with no rule (CA-122's VAT-exclude file): no warning, numbers as CA-122 TC-02.
// U5  Polar Bear's PDF on gemini-2.5-flash-lite, which used to read the buyer as the vendor.
//
// Needs, as env:
//   PLAYWRIGHT_CORE  path to a playwright-core package (the npx cache has one)
//   CHROME_EXE       a Chromium binary, when that package's own build is not installed
//   OCR_SESSION_JS   the snippet `scripts/dev/seed_browser_session.py --bu carmencloud` prints
//   APP_URL          default http://localhost:3011 (vite proxied to a backend on this branch)
//   CARMEN_WEB_ENV   default ~/Documents/bruno/Carmen-PMS/.env (CARMEN_WEB_JWT, carmencloud)
// Files come from backend/scratch/ca123/ (the e2e script writes them); screenshots go to
// .playwright-mcp/ca123/. Every UI extraction but U3's costs carmencloud one credit.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SCRATCH = path.join(ROOT, 'backend/scratch/ca123')
const SHOTS = path.join(ROOT, '.playwright-mcp/ca123')
const APP = process.env.APP_URL || 'http://localhost:3011'
const CARMEN = 'https://dev.carmen4.com/Carmen.API/api'
const VENDOR = 'P20230002'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE)

const results = []
function check(scenario, name, ok, detail = '') {
  results.push({ scenario, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${scenario} ${name}${detail ? `  (${detail})` : ''}`)
}
const num = s => parseFloat(String(s).replace(/,/g, '')) || 0
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol

function session() {
  const js = process.env.OCR_SESSION_JS || ''
  const token = js.match(/ocr_access_token', '([^']+)'/)?.[1]
  const user = js.match(/ocr_user:v1', '([^']+)'/)?.[1]
  if (!token || !user) throw new Error('OCR_SESSION_JS is missing or not the seed script output')
  return { token, user }
}

function webJwt() {
  const file =
    process.env.CARMEN_WEB_ENV || path.join(os.homedir(), 'Documents/bruno/Carmen-PMS/.env')
  const jwt = fs
    .readFileSync(file, 'utf8')
    .match(/^CARMEN_WEB_JWT=(.*)$/m)?.[1]
    ?.trim()
  if (!jwt) throw new Error(`no CARMEN_WEB_JWT in ${file}`)
  return jwt
}

async function carmen(method, url) {
  const res = await fetch(`${CARMEN}${url}`, {
    method,
    headers: { Authorization: `Bearer ${webJwt()}` },
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

/** The page a scenario is on, so a failure can be photographed where it happened. */
let current = null

async function openWizard(browser, lang = 'en') {
  const { token, user } = session()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(
    ([t, u, l]) => {
      sessionStorage.setItem('ocr_access_token', t)
      sessionStorage.setItem('ocr_user:v1', u)
      localStorage.setItem('lang', l)
    },
    [token, user, lang]
  )
  const page = await context.newPage()
  current = page
  await page.goto(`${APP}/#/APInvoice`)
  await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 30000 })
  return page
}

/** Upload, pass Step 2, and land on Step 3. "Duplicate document found" is answered Proceed. */
async function toStep3(page, file) {
  await page.locator('input[type=file]').first().setInputFiles(file)
  const confirm = page.getByRole('button', { name: /Confirm Field Mapping/i })
  const proceedAnyway = page.getByRole('button', { name: /Proceed Anyway/i })
  await confirm.or(proceedAnyway).first().waitFor({ timeout: 120000 })
  if (await proceedAnyway.isVisible().catch(() => false)) {
    await proceedAnyway.click()
    await confirm.waitFor({ timeout: 60000 })
  }
  await confirm.click()
  // Not "Proceed": with a totals mismatch it reads "Proceed (Skip Warning)".
  await page.getByRole('button', { name: /Back to Mapping/ }).waitFor({ timeout: 30000 })
}

async function step3(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('table tbody tr')]
      // The row inputs are named by aria-label (`aria-label={fld}` in APTableRow).
      .map(tr =>
        Object.fromEntries(
          [...tr.querySelectorAll('input[aria-label]')].map(i => [
            i.getAttribute('aria-label'),
            i.value,
          ])
        )
      )
      .filter(r => 'qty' in r)
    const vendor =
      document.querySelector('input[placeholder="Please select a vendor"]')?.value || ''
    const banner = document.querySelector('.extraction-warning-banner')?.innerText || ''
    return { rows, vendor, banner, body: document.body.innerText }
  })
}

function checkPackRows(sc, s) {
  check(sc, '4 rows', s.rows.length === 4, `${s.rows.length}`)
  for (const [i, r] of s.rows.entries()) {
    const q = num(r.qty),
      p = num(r.unitPrice),
      sub = num(r.lineSubTotal)
    check(
      sc,
      `row ${i + 1} qty × price = line sub total`,
      near(q * p, sub, 0.01),
      `${q} × ${p} vs ${sub}`
    )
  }
  const find = k => s.rows.find(r => r.description.includes(k)) || {}
  for (const [k, q, p] of [
    ['กะทิ', 1, 915.89],
    ['แป้ง', 1, 382.24],
  ]) {
    const r = find(k)
    check(
      sc,
      `${k} is the PACK pair`,
      num(r.qty) === q && num(r.unitPrice) === p,
      `${r.qty} × ${r.unitPrice}`
    )
  }
  check(sc, `vendor auto-matched ${VENDOR}`, s.vendor.startsWith(VENDOR), s.vendor.slice(0, 60))
  check(sc, 'Totals matched', s.body.includes('Totals matched'))
  check(sc, 'no qty × price warning', !s.banner.includes('Qty × unit price'), s.banner.slice(0, 80))
}

async function mapAccounts(page) {
  await page.getByRole('button', { name: /^Proceed$/ }).click()
  await page.getByRole('button', { name: /AI Suggest/ }).click()
  const anyway = page.getByRole('button', { name: /Suggest Anyway/ })
  if (
    await anyway.waitFor({ timeout: 5000 }).then(
      () => true,
      () => false
    )
  )
    await anyway.click()
  const acceptAll = page.getByRole('button', { name: /^Accept All$/ })
  await acceptAll.waitFor({ timeout: 120000 })
  await acceptAll.click()
  const confirmAll = page.getByRole('button', { name: /Confirm Accept All/ })
  if (
    await confirmAll.waitFor({ timeout: 3000 }).then(
      () => true,
      () => false
    )
  )
    await confirmAll.click()
  return page.evaluate(() =>
    [...document.querySelectorAll('table tbody tr')].map(tr =>
      [...tr.querySelectorAll('input')].map(i => i.value)
    )
  )
}

/** Every POST to Carmen's invoice proxy, recorded; faked unless `real`. */
async function recordPosts(page, { real }) {
  const posts = []
  await page.route('**/api/v1/carmen/invoice**', async route => {
    const req = route.request().postDataJSON()
    if (real) {
      const res = await route.fetch()
      const body = await res.json()
      posts.push({ req, body })
      await route.fulfill({ response: res })
    } else {
      const body = { Code: 0, UserMessage: 'Add Success', InternalMessage: 'QA-DRY', MoreInfo: '' }
      posts.push({ req, body })
      await route.fulfill({ json: body })
    }
  })
  return posts
}

function checkPayload(sc, req) {
  check(sc, `payload VnCode ${VENDOR}`, req.VnCode === VENDOR, req.VnCode)
  check(sc, 'payload TaxStatus Pending', req.TaxStatus === 'Pending', req.TaxStatus)
  for (const [i, d] of (req.Detail || []).entries()) {
    const q = num(d.InvdQty),
      p = num(d.InvdPrice)
    check(
      sc,
      `payload line ${i + 1} qty × price = net`,
      near(q * p, num(d.NetAmt)),
      `${q} × ${p} vs ${d.NetAmt}`
    )
    check(sc, `payload line ${i + 1} total = unpaid`, near(num(d.TotalPrice), num(d.UnPaid)))
  }
}

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
}

const SAMPLE = path.join(SCRATCH, 'polar_bear.pdf')

const scenarios = {
  async U1(browser) {
    const page = await openWizard(browser)
    await toStep3(page, SAMPLE)
    const s = await step3(page)
    await shot(page, 'U1-step3')
    checkPackRows('U1', s)
    const mapped = await mapAccounts(page)
    check(
      'U1',
      'AI Suggest mapped every row',
      mapped.every(r => r.filter(Boolean).length >= 2),
      JSON.stringify(mapped)
    )
    const posts = await recordPosts(page, { real: true })
    await page.getByRole('button', { name: /Generate AP Invoice/ }).click()
    const change = page.getByRole('button', { name: /Change Invoice Number/ })
    await change.waitFor({ timeout: 60000 })
    check(
      'U1',
      'Carmen refused the duplicate number',
      posts[0]?.body?.Code < 0,
      posts[0]?.body?.UserMessage
    )
    await change.click()
    const newNo = `CA123-E2E-${Date.now().toString().slice(-6)}`
    await page.getByRole('dialog').locator('input').fill(newNo)
    await page.getByRole('button', { name: /Re-submit/ }).click()
    await page.getByText(`AP Invoice ${newNo} created`).waitFor({ timeout: 60000 })
    const last = posts.at(-1)
    check('U1', 'Carmen accepted the re-submit', last?.body?.Code === 0, JSON.stringify(last?.body))
    checkPayload('U1', last.req)
    const seq = last.body.InternalMessage
    fs.writeFileSync(path.join(SCRATCH, 'ui_posted.json'), JSON.stringify({ seq, invNo: newNo }))
    const { body } = await carmen('GET', `/apInvoice/${seq}`)
    const inv = body?.Data ?? body
    check(
      'U1',
      'read back: number, vendor, total, status',
      inv?.InvhInvNo === newNo &&
        inv?.VnCode === VENDOR &&
        near(inv?.InvhTotalAmt, 4212.01) &&
        inv?.TaxStatus === 'Pending',
      `${inv?.InvhInvNo} ${inv?.VnCode} ${inv?.InvhTotalAmt} ${inv?.TaxStatus}`
    )
    for (const [i, d] of (inv?.Detail || []).entries()) {
      check(
        'U1',
        `read back line ${i + 1}: qty × price = net, total = unpaid`,
        near(d.InvdQty * d.InvdPrice, d.NetAmt) && near(d.TotalPrice, d.UnPaid),
        `${d.InvdQty} × ${d.InvdPrice} / ${d.NetAmt} / ${d.TotalPrice} / ${d.UnPaid}`
      )
    }
    await page.context().close()
  },

  async U2(browser) {
    const page = await openWizard(browser)
    await toStep3(page, path.join(SCRATCH, 'polar_bear.png'))
    const s = await step3(page)
    await shot(page, 'U2-step3-png')
    checkPackRows('U2', s)
    await mapAccounts(page)
    const posts = await recordPosts(page, { real: false })
    await page.getByRole('button', { name: /Generate AP Invoice/ }).click()
    await page.waitForTimeout(3000)
    check('U2', 'one post captured', posts.length === 1, `${posts.length}`)
    if (posts[0]) checkPayload('U2', posts[0].req)
    await page.context().close()
  },

  async U3(browser) {
    for (const [fixture, label] of [
      ['ap_warning_fixture.json', 'misread'],
      ['ap_warning_only_fixture.json', 'warning-only'],
    ]) {
      const page = await openWizard(browser, 'en')
      const json = JSON.parse(fs.readFileSync(path.join(SCRATCH, fixture), 'utf8'))
      await page.route('**/api/v1/ap-invoice/extract**', route => route.fulfill({ json }))
      await toStep3(page, SAMPLE)
      let s = await step3(page)
      check(
        'U3',
        `${label}: EN banner names line 2`,
        s.banner.includes('Qty × unit price does not equal the amount on line 2'),
        s.banner.slice(0, 120)
      )
      if (label === 'misread') {
        check(
          'U3',
          'misread: the table shows the 3,936.42 the lines add up to',
          s.body.includes('3,936.42')
        )
        check('U3', 'misread: no "Totals matched"', !s.body.includes('Totals matched'))
        const skip = page.getByRole('button', { name: /Proceed \(Skip Warning\)/ })
        check(
          'U3',
          'misread: the mismatch asks for "Proceed (Skip Warning)"',
          await skip.isVisible()
        )
      }
      await shot(page, `U3-${label}-en`)
      await page.getByRole('button', { name: 'เปลี่ยนเป็นภาษาไทย' }).click()
      await page
        .locator('.extraction-warning-banner', { hasText: 'บรรทัดที่' })
        .waitFor({ timeout: 5000 })
        .catch(() => {})
      s = await step3(page)
      check(
        'U3',
        `${label}: TH banner names line 2`,
        s.banner.includes('บรรทัดที่ 2'),
        s.banner.slice(0, 120)
      )
      await shot(page, `U3-${label}-th`)
      if (label === 'warning-only') {
        await page.getByRole('button', { name: 'Switch to English' }).click()
        const proceed = page.getByRole('button', { name: /^Proceed$/ })
        check('U3', 'warning-only: Proceed enabled', await proceed.isEnabled())
        await proceed.click()
        const step4 = page.getByRole('button', { name: /AI Suggest/ })
        check(
          'U3',
          'warning-only: Step 4 reached',
          await step4.waitFor({ timeout: 10000 }).then(
            () => true,
            () => false
          )
        )
      }
      await page.context().close()
    }
  },

  async U4(browser) {
    const page = await openWizard(browser)
    await toStep3(page, path.join(SCRATCH, 'CA-122_QA_vat_exclude.pdf'))
    const s = await step3(page)
    await shot(page, 'U4-step3-non-rule-vendor')
    check(
      'U4',
      'no qty × price warning',
      !s.banner.includes('Qty × unit price'),
      s.banner.slice(0, 80)
    )
    check('U4', '2 rows', s.rows.length === 2, `${s.rows.length}`)
    const taxes = s.rows.map(r => num(r.taxAmt)).sort((a, b) => b - a)
    check(
      'U4',
      'tax 56.00 and 14.00 (CA-122 TC-02)',
      near(taxes[0], 56) && near(taxes[1], 14),
      taxes.join(', ')
    )
    check('U4', 'Totals matched', s.body.includes('Totals matched'))
    await page.context().close()
  },

  async U5(browser) {
    const page = await openWizard(browser)
    await toStep3(page, SAMPLE)
    const s = await step3(page)
    await shot(page, 'U5-step3-gemini-2.5')
    checkPackRows('U5', s)
    await page.context().close()
  },
}

async function cleanup() {
  const seqs = ['317']
  const posted = path.join(SCRATCH, 'ui_posted.json')
  if (fs.existsSync(posted)) seqs.push(JSON.parse(fs.readFileSync(posted, 'utf8')).seq)
  for (const seq of seqs) {
    const del = await carmen(
      'DELETE',
      `/apInvoice/${seq}?user=admin&voidRemark=${encodeURIComponent('CA-123 e2e')}`
    )
    const after = await carmen('GET', `/apInvoice/${seq}`)
    const inv = after.body?.Data ?? after.body
    console.log(
      `void ${seq}: DELETE ${del.status} ${JSON.stringify(del.body)} -> now ${after.status} ${inv?.InvhStatus ?? '(gone)'}`
    )
  }
}

const wanted = process.argv.slice(2)
if (wanted.includes('cleanup')) {
  await cleanup()
} else {
  if (!fs.existsSync(SAMPLE)) {
    const src =
      process.env.POLAR_BEAR_PDF ||
      path.join(os.homedir(), 'Downloads', 'ตัวอย่าง invoice ที่มี qty price หลาย column.pdf')
    fs.copyFileSync(src, SAMPLE)
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE || undefined })
  for (const name of wanted) {
    try {
      await scenarios[name](browser)
    } catch (e) {
      check(name, 'ran to the end', false, String(e).split('\n')[0])
      if (current && !current.isClosed()) {
        await shot(current, `${name}-FAILED`).catch(() => {})
        const text = await current
          .locator('body')
          .innerText()
          .catch(() => '')
        console.log(`  page at failure: ${text.replace(/\s+/g, ' ').slice(0, 400)}`)
        await current.context().close()
      }
    }
  }
  await browser.close()
  const failed = results.filter(r => !r.ok)
  fs.writeFileSync(
    path.join(SCRATCH, `ui_${wanted.join('_')}.json`),
    JSON.stringify(results, null, 1)
  )
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}
