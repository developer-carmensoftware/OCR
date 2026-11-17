// One PMS day on a REAL deployed site (QA by default), as a reviewer sees it — the checks that
// depend on the environment: the queue row, the dialog laid out as that PMS's mapping table,
// Approve → Carmen posts → JV + Open JV, Reject. The dialog's own behaviour (Undo, a blank row
// blocking Approve, the department filter) is the same code everywhere and is covered by
// pms_seeded_days_ui.mjs and the frontend tests.
//
//   node scripts/qa/pms_qa_site_ui.mjs <PMS> <dd/mm/yyyy>                 # look only
//   node scripts/qa/pms_qa_site_ui.mjs <PMS> <dd/mm/yyyy> --approve       # posts a real JV: void it
//   node scripts/qa/pms_qa_site_ui.mjs <PMS> <dd/mm/yyyy> --reject "why"
//
// Env: APP_URL [https://ocr-tau-five.vercel.app], BU [carmencloud], CARMEN_URI
// [https://dev.carmen4.com], CARMEN_AUTHORIZATION (that BU's menu token; else backend/.env),
// PLAYWRIGHT_CORE / CHROME_EXE as in the other suites. Prints PASS/FAIL lines and the JV number,
// never the token. Exit 1 on any FAIL. Shots: .playwright-mcp/pms-qa-site/.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [PMS, DMY, action, reason] = process.argv.slice(2)
if (!PMS || !/^\d{2}\/\d{2}\/\d{4}$/.test(DMY || '')) {
  console.error('usage: pms_qa_site_ui.mjs <PMS> <dd/mm/yyyy> [--approve | --reject "why"]')
  process.exit(2)
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, '.playwright-mcp/pms-qa-site')
const APP = process.env.APP_URL || 'https://ocr-tau-five.vercel.app'
const BU = process.env.BU || 'carmencloud'
const URI = process.env.CARMEN_URI || 'https://dev.carmen4.com'
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW = process.env.PLAYWRIGHT_CORE || path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME = process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)
const envFile = path.join(ROOT, 'backend/.env')
const TOKEN = (
  process.env.CARMEN_AUTHORIZATION ||
  (fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').match(/^CARMEN_AUTHORIZATION=(.*)$/m)?.[1] : '') ||
  ''
).trim().replace(/^"|"$/g, '')
if (!TOKEN) {
  console.error('CARMEN_AUTHORIZATION is not set (the BU menu token)')
  process.exit(2)
}

let failed = 0
const check = (ok, msg, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${detail ? `  (${detail})` : ''}`)
}
const tag = `${PMS}-${DMY.replaceAll('/', '')}`
fs.mkdirSync(OUT, { recursive: true })
const shot = (page, step) => page.screenshot({ path: path.join(OUT, `${tag}-${step}.png`) })

const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const rowOf = () => page.getByRole('row').filter({ hasText: DMY }).filter({ hasText: `${PMS} · Daily` })

async function queue(tab) {
  await page.goto(`${APP}/#/CreditCardOCR`)
  await page.getByRole('tab').first().waitFor({ timeout: 60000 })
  if (tab) {
    const t = page.getByRole('tab').filter({ hasText: tab })
    if (await t.count()) await t.first().click()
  }
  await page.waitForTimeout(3000)
}

try {
  await page.goto(`${APP}/#/CreditCardOCR?${new URLSearchParams({ token: TOKEN, bu: BU, uri: URI })}`)
  const consent = page.locator('.uc-confirm-btn')
  await Promise.race([
    page.getByText(/AI JV Automation/).first().waitFor({ timeout: 90000 }),
    consent.waitFor({ timeout: 90000 }),
  ])
  await page.waitForTimeout(2000)
  if (await consent.isVisible()) {
    await page.locator('input[type="checkbox"]').first().check()
    await consent.click()
    await page.waitForTimeout(2000)
  }

  await queue()
  const row = rowOf()
  const rowText = ((await row.first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
  check((await row.count()) === 1, `the queue has one row for ${PMS} · Daily ${DMY}`, rowText.slice(0, 140))
  check(/AI suggested mapping|Mapping missing|Ready to post/.test(rowText), 'the row says what the day needs', rowText.slice(0, 140))

  await row.first().getByRole('button').first().click()
  const dialog = page.getByRole('dialog').first()
  await dialog.locator('table tbody tr').first().waitFor({ timeout: 90000 })
  await page.waitForTimeout(1500)
  const text = (await dialog.innerText()).replace(/\s+/g, ' ')
  check(text.includes(`${PMS} · Daily · ${DMY}`), `the dialog is ${PMS} · Daily · ${DMY}`)
  const head = (await dialog.locator('table thead th').allInnerTexts()).map(t => t.trim()).filter(Boolean)
  check(head.slice(-3).join('|').toLowerCase() === 'deptcode|acccode|accdesc' && head.length >= 4,
    "the columns are the PMS's key columns, then DeptCode · AccCode · AccDesc", head.join(' | '))
  check(!/\bAmount\b|\bDr\b|\bCr\b/.test(text), 'no amount and no Dr/Cr anywhere in the review')
  const rows = await dialog.locator('table tbody tr').count()
  const pickers = await dialog.locator('input[aria-label^="Account for "]').count()
  const ai = await dialog.locator('.pms-tag-ai').count()
  // A day whose every row Carmen maps ("Ready to post") has no picker: it only needs Approve.
  const ready = /Ready to post/.test(rowText)
  check(rows > 0 && (ready ? pickers === 0 : pickers > 0) && ai <= pickers,
    `${rows} rows, ${pickers} new with pickers, ${ai} tagged AI${ready ? ' (Ready to post)' : ''}`)
  const approve = dialog.getByRole('button', { name: /approve and post/i })
  const blocked = text.includes('Pick an account for every new row.')
  check((await approve.isEnabled()) === !blocked, `Approve is ${blocked ? 'blocked, and says why' : 'open'}`)
  await shot(page, 'dialog')

  if (action === '--approve') {
    await approve.click()
    const err = dialog.locator('[role="alert"], .text-danger')
    await Promise.race([dialog.waitFor({ state: 'hidden', timeout: 240000 }), err.first().waitFor({ timeout: 240000 })])
    const closed = !(await dialog.isVisible().catch(() => false))
    check(closed, 'Approve and post: Carmen posted the day', closed ? '' : ((await err.first().textContent()) || '').trim().slice(0, 200))
    await queue('All')
    const done = ((await rowOf().first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
    // The JV number from the link: in the row's text it runs into the time ("16:351704").
    const link = rowOf().first().getByRole('link', { name: /Open JV/ })
    const href = (await link.count()) ? await link.getAttribute('href') : ''
    const jv = href?.match(/\/glJv\/(\d+)\/show/)?.[1]
    check(/Success/.test(done) && !!jv && done.includes(jv), 'the queue row reads Success with its JV number', done.slice(0, 160))
    check(!!jv, 'Open JV links to that JV in Carmen', href || 'no link')
    console.log(`JV ${jv || '?'}  ← void it`)
    await shot(page, 'posted')
  } else if (action === '--reject') {
    await dialog.getByRole('button', { name: /^Reject/ }).click()
    const box = page.getByRole('dialog').filter({ hasText: /reject/i }).last()
    const field = box.locator('textarea, input[type="text"]').first()
    if (await field.count()) await field.fill(reason || 'QA check')
    await box.getByRole('button', { name: /^Reject/ }).last().click()
    await dialog.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    await queue('All')
    const done = ((await rowOf().first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
    check(/Rejected/i.test(done), 'the queue row reads Rejected', done.slice(0, 160))
    await shot(page, 'rejected')
  }
} catch (e) {
  check(false, 'the run', String(e.message || e).slice(0, 200))
} finally {
  check(errors.length === 0, 'no uncaught error in the page', errors[0]?.slice(0, 160) || '')
  await browser.close()
}
process.exit(failed ? 1 : 0)
