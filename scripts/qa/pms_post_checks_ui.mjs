// Decision-log #52/#53 — Carmen's post checks the mapping, and every PMS is reviewable: the
// full-system E2E. HotelTime (`Revenue` rows, `HT_Code` columns) and Cloudbeds (`Transaction`
// beside `Statistic`, a `Channel` column) park with their own tables, new rows and the AI's
// picks; Approve writes the accounts into Carmen, whose engine then posts or answers. A
// PartnerApi PMS's days are opened by the sweep. Data half: pms_post_checks_e2e.py.
//
//   node scripts/qa/pms_post_checks_ui.mjs
//
// S setup · O opening PartnerApi days (first: the BU's interface list is cached once a day) ·
// N HotelTime reviewed in the browser: rejected and brought back (N-08), read in Thai and on a
// phone (L) while it is parked, then approved (N-04) · A auto-post · R a repeat hook ·
// CB Cloudbeds through Carmen's engine to a JV · E hygiene · T teardown (always).
// Rows the AI leaves without an account get GEN/1021001 by hand (`fillMissing`).
// Since ask N closed (HotelTime's balance account is in the chart), Carmen's engine posts
// HotelTime: N-04 and A-02 each make a JV, and every case takes either answer.
//
// Needs the stack of pms_third_parties_ui.mjs, with the backend started by
// scripts/qa/pms_backend_stub.py (interface list switchable from .playwright-mcp/pms-pc/interfaces.json).
// **Start that backend afresh before every run:** the sweep caches each BU's interface list for
// the day, and a warm cache from an earlier run skips the outage O-06 stages (O-02/O-03/O-06 fail).
// PMS_E2E_CB=0 skips the CB group, for a rerun that should make no real JV.
// **Carmen dev writes:** HotelTime's mapping table (N-04's Approve writes the day's accounts, A-02
// maps the rest; teardown puts the snapshot back). Cloudbeds' empty table gets the day's 78 keys
// with the accounts Approve wrote, and the post may make **one real JV, voided at once** (CB-04
// stops the run if it cannot be); teardown empties the table again. HotelTime's JVs (N-04, A-02)
// are voided at once too, so a full run makes up to three real JVs and leaves none.

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, '.playwright-mcp/pms-pc')
const SWITCH = path.join(OUT, 'interfaces.json')
const APP = process.env.APP_URL || 'http://localhost:3011'
const API = process.env.API_URL || 'http://127.0.0.1:8011'
const BE_LOG = process.env.BE_LOG || path.join(os.tmpdir(), 'be8011.log')
const PY = process.env.PYTHON || path.join(ROOT, 'backend/venv/Scripts/python.exe')
const HELPER = path.join(ROOT, 'scripts/qa/pms_post_checks_e2e.py')
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

const ENV = fs.readFileSync(path.join(ROOT, 'backend/.env'), 'utf8')
const envVar = name => ENV.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim().replace(/^"|"$/g, '')
const CARMEN = envVar('CARMEN_AUTHORIZATION')
const JOB = envVar('INTERNAL_JOB_TOKEN')
const URI = 'https://dev.carmen4.com'
const BU = 'pms-pc'
const BU_B = 'pms-pc-b'
const DAY_N = '2026-10-06' // HotelTime's day reviewed in the browser (Data Bank Id 171)
const DAY_A1 = '2026-10-05' // auto-post: waits for its new keys, then posts once mapped
const HT_DAYS = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']
const CB = 'Cloudbeds.PMS'
const CB_DAY = '2026-10-26' // Data Bank Id 184: 86 Transaction rows, 78 keys
const CB_DAY2 = '2026-10-29' // Id 178: 87 keys, some new to CB_DAY
const CB_COLS = 'Description,MarketSegmentDesc'
let cbSnapped = false // teardown empties Cloudbeds' table only when this run found it empty
let cbBase = [] // the live JVs on the Cloudbeds days before the run (Carmen's own, e.g. 1588)
let cbRan = false // the CB group ran (E-03 counts its AI calls)
const ict = new Date(Date.now() + 7 * 3600e3)
const YESTERDAY = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), ict.getUTCDate() - 1))
  .toISOString()
  .slice(0, 10)
const AFTER_EIGHT = ict.getUTCHours() >= 8

const results = []
const pageErrors = []
let page
let context
let session

function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? `  (${detail})` : ''}`)
  return Boolean(ok)
}
class Stop extends Error {}
const sleep = ms => new Promise(r => setTimeout(r, ms))

function py(...args) {
  const r = spawnSync(PY, [HELPER, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' }
}
function pyJson(...args) {
  const r = py(...args)
  if (r.code !== 0) throw new Error(`helper ${args[0]} failed: ${r.err.slice(-500)}`)
  return JSON.parse(r.out.trim().split('\n').pop())
}
const dayOf = (rows, bu, date, pms = 'hoteltime') =>
  rows.find(r => r.bu === bu && r.event_id.toLowerCase() === `pms/${pms}/daily/${date}`)
const daysOf = (rows, bu, date, pms = 'hoteltime') =>
  rows.filter(r => r.bu === bu && r.event_id.toLowerCase() === `pms/${pms}/daily/${date}`)

async function until(pred, ms = 90000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const hit = pred(pyJson('state'))
    if (hit) return hit
    await sleep(2000)
  }
  return null
}

async function http(method, url, { headers = {}, body } = {}) {
  const send = () =>
    fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
  let res
  try {
    res = await send()
  } catch (e) {
    console.log(`  (retrying ${method} ${url}: ${e.cause?.code || e.message})`)
    res = await send()
  }
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text }
}
const carmenApi = async (method, p, body) => {
  const r = await http(method, `${API}/api/v1/carmen/pms${p}`, { headers: { Authorization: CARMEN }, body })
  await sleep(3500) // Carmen's settings API: 20 calls a minute per IP
  return r
}
const hook = (key, date, name = 'HotelTime') =>
  http('POST', `${API}/api/v1/pms/events`, {
    headers: { Authorization: `Bearer ${key}` },
    body: { InterfaceType: 'PMS', InterfaceName: name, DocType: 'Daily', DocDate: date },
  })
const sweep = () => http('POST', `${API}/api/v1/pms/process/run`, { headers: { Authorization: `Bearer ${JOB}` } })
/** interfacePostGL calls since `since`, once the outbound log has been written (every 10 s). */
async function posts(since) {
  await sleep(11000)
  const r = py('posts-since', since)
  if (r.code !== 0) throw new Error(`posts-since failed: ${r.err.slice(-300)}`)
  return Number(r.out.trim().split('\n').pop())
}
/** interfacePreviewPostGL calls since `since`: how a day is read since decision-log #54. */
async function previews(since) {
  await sleep(11000)
  const r = py('previews-since', since)
  if (r.code !== 0) throw new Error(`previews-since failed: ${r.err.slice(-300)}`)
  return Number(r.out.trim().split('\n').pop())
}
const setSwitch = mode => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(SWITCH, JSON.stringify(mode))
}
const dmy = iso => iso.split('-').reverse().join('/')

async function shot(name) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

async function signIn(bu) {
  if (page) await page.close()
  page = await context.newPage()
  page.on('pageerror', err => pageErrors.push(String(err)))
  await page.goto(`${APP}/#/CreditCardOCR?${new URLSearchParams({ token: CARMEN, bu, uri: URI })}`)
  const heading = page.getByText('AI JV Automation').first()
  const consent = page.locator('.uc-confirm-btn')
  await Promise.race([heading.waitFor({ timeout: 60000 }), consent.waitFor({ timeout: 60000 })])
  await page.waitForTimeout(1500)
  if (await consent.isVisible()) {
    await page.locator('input[type="checkbox"]').first().check()
    await consent.click()
  }
  await heading.waitFor({ timeout: 60000 })
  session = await page.evaluate(() => sessionStorage.getItem('ocr_access_token'))
  if (!session) throw new Stop('SSO exchange left no session token')
}

async function chip(name) {
  await page.goto(`${APP}/#/CreditCardOCR`)
  await page.reload()
  const tab = page.getByRole('tab', { name: new RegExp(`^${name === 'Review' ? 'Review' : 'All'}`) })
  await tab.waitFor({ timeout: 30000 })
  await tab.click()
  if (name !== 'Review' && name !== 'All') {
    // Posted / Not posted are the `Filter` menu's Status values (the filter bar of #359).
    const menu = page.locator('.rq-menu')
    await page.getByRole('button', { name: /^Filter$/ }).click()
    await menu.getByRole('menuitem', { name: /^Status/ }).click()
    await menu.locator('[role^="menuitem"]').filter({ hasText: new RegExp(`^${name}(\\s|$)`) }).click()
    await page.mouse.click(4, 4) // close the menu as a reader does
  }
  await page.waitForTimeout(1500)
}
const queueRow = (date, pms = 'HotelTime') =>
  page.getByRole('row').filter({ hasText: dmy(date) }).filter({ hasText: `${pms} · Daily` })

async function openDay(date, pms = 'HotelTime') {
  await chip('Review')
  await queueRow(date, pms).getByRole('button', { name: 'Review' }).click()
  const dialog = page.getByRole('dialog').first()
  await dialog.waitFor({ timeout: 30000 })
  await dialog.getByText(`${pms} · Daily`, { exact: false }).waitFor({ timeout: 60000 })
  await page.waitForTimeout(800)
  return dialog
}
const approveIn = dialog => dialog.getByRole('button', { name: /approve and post/i })
async function alertIn(dialog, ms = 90000) {
  const a = dialog.getByRole('alert')
  await a.waitFor({ timeout: ms })
  return (await a.innerText()).trim()
}
const llmNow = () => Number(py('llm').out.trim().split('\n').pop())
/** The new keys still waiting on a person: no account, or only the AI's (`open_keys`). */
const openOf = payload => (payload?.missing?.length || 0) + (payload?.ai?.length || 0)
const accountInputs = dialog => dialog.locator('input[aria-label^="Account for "]')

/** Pick `code` in one of the review's pickers (as pms_third_parties_ui.mjs does). */
async function pick(input, code) {
  await input.click()
  await input.fill(code)
  const option = page.locator('.css-select-panel [role="button"]:not([aria-disabled="true"])')
  await option.first().waitFor({ timeout: 10000 })
  const n = await option.count()
  for (let i = 0; i < n; i++) {
    if ((await option.nth(i).innerText()).trim().startsWith(code)) {
      await option.nth(i).click()
      return true
    }
  }
  await input.press('Escape')
  return false
}

/** Give every new row the AI left without an account GEN/1021001, as a reviewer would. */
async function fillMissing(dialog) {
  const accs = accountInputs(dialog)
  const n = await accs.count()
  let filled = 0
  for (let i = 0; i < n; i++) {
    const acc = accs.nth(i)
    if ((await acc.inputValue()).trim()) continue
    const label = (await acc.getAttribute('aria-label')).slice('Account for '.length)
    const dept = dialog.getByLabel(`Dept for ${label}`, { exact: true })
    if (!(await pick(dept, 'GEN')) || !(await pick(acc, '1021001'))) throw new Stop(`could not pick for ${label}`)
    filled++
  }
  return filled
}

/** What Carmen made of an Approve: the day posted (the dialog closes), or its words in it. */
async function outcome(dialog, date, pms) {
  for (let i = 0; i < 60; i++) {
    await sleep(2000)
    const d = dayOf(pyJson('state'), BU, date, pms)
    if (d?.status === 'posted') return { posted: d, refusal: '' }
    const alert = dialog.getByRole('alert').first()
    if (await alert.isVisible().catch(() => false)) return { posted: null, refusal: (await alert.innerText()).trim() }
  }
  return { posted: null, refusal: '' }
}

/** Close the review, discarding picks when it asks first. */
async function closeDialog() {
  await page.keyboard.press('Escape')
  const leave = page.getByRole('dialog').filter({ hasText: 'Leave without posting?' })
  if (await leave.waitFor({ timeout: 3000 }).then(() => true).catch(() => false))
    await leave.getByRole('button', { name: 'Discard changes' }).click()
}

async function run() {
  // ── S — setup ─────────────────────────────────────────────────────────────────
  const real = pyJson('interfaces')
  const asPartner = real.map(r =>
    String(r.InterfaceName).toLowerCase() === 'hoteltime' && r.DocType === 'REVENUE' ? { ...r, From: 'PartnerApi' } : r
  )
  check('S-00', 'Carmen lists HotelTime (REVENUE → GL); our stub lists it as PartnerApi',
    asPartner.some(r => r.From === 'PartnerApi' && String(r.InterfaceName).toLowerCase() === 'hoteltime'),
    `${real.length} rows`)
  py('reset') // a clean run: the two test tenants' days from an earlier run are forgotten
  setSwitch({ mode: '500' }) // O-06: the first sweep meets Carmen's list down
  const keys = {}
  for (const [bu, pms] of [[BU, 'hoteltime'], [BU, 'comanche'], [BU_B, 'hoteltime'], [BU, 'cloudbeds']]) {
    const r = await carmenApi('POST', '/keys', { uri: URI, bu, pms })
    keys[`${bu}/${pms}`] = r.json?.api_key
    check('S-01', `key for ${bu} × ${pms}`, r.status === 201 && r.json?.api_key?.startsWith('cpk_'), `HTTP ${r.status}`)
  }
  if (!keys[`${BU}/hoteltime`] || !keys[`${BU_B}/hoteltime`]) throw new Stop('no keys')
  for (const [bu, on] of [[BU, true], [BU_B, false]]) {
    const r = await carmenApi('PUT', '/settings', { uri: URI, bu, pms: 'hoteltime', auto_post: on })
    check('S-02', `auto-post ${on ? 'on' : 'off'} for ${bu} × hoteltime`, r.status === 200 && r.json?.auto_post === on, `HTTP ${r.status}`)
  }
  const t0 = new Date().toISOString()
  const llm0 = Number(py('llm').out.trim().split('\n').pop())

  // ── O — the sweep opens PartnerApi days (yesterday, after 08:00 ICT) ───────────
  if (!AFTER_EIGHT) throw new Stop('before 08:00 ICT: the sweep opens nothing yet; run again later')
  // O-07 setup: the second BU's hook for yesterday comes first, spelled as the hook spells it.
  let r = await hook(keys[`${BU_B}/hoteltime`], YESTERDAY)
  check('O-07', `a hook stores ${BU_B}'s ${YESTERDAY} first`, r.status === 202, `HTTP ${r.status}`)
  let sw = await sweep()
  let rows = pyJson('state')
  check('O-06', "Carmen's list down: the sweep opens nothing, and says so in its summary",
    sw.status === 200 && (sw.json?.opened ?? -1) === 0 && !dayOf(rows, BU, YESTERDAY), `sweep=${sw.text.slice(0, 120)}`)
  setSwitch({ mode: 'list', rows: asPartner })
  sw = await sweep()
  const opened = await until(rs => {
    const d = dayOf(rs, BU, YESTERDAY)
    return d && d.reason_code ? d : null
  })
  check('O-06', 'the list back: the next sweep opens the day (a failed read was not cached)',
    sw.status === 200 && sw.json?.opened >= 1 && !!opened, `sweep=${sw.text.slice(0, 120)}`)
  rows = pyJson('state')
  const bDays = daysOf(rows, BU_B, YESTERDAY)
  check('O-07', 'the day a hook stored in another casing (HotelTime vs Carmen\'s Hoteltime) is not opened again',
    bDays.length === 1 && bDays[0].event_id === `PMS/HotelTime/Daily/${YESTERDAY}`, bDays.map(d => d.event_id).join(','))
  const com = rows.filter(x => x.bu === BU && x.event_id.toLowerCase() === `pms/comanche/daily/${YESTERDAY}`)
  check('O-01', `the sweep opened ${BU}'s HotelTime ${YESTERDAY} once, and not Comanche (a CarmenApi PMS)`,
    daysOf(rows, BU, YESTERDAY).length === 1 && com.length === 0, `hoteltime=${daysOf(rows, BU, YESTERDAY).length} comanche=${com.length}`)
  check('O-02', "Carmen has no data for it: day_not_ready, still received, no try spent",
    opened?.status === 'received' && opened?.reason_code === 'day_not_ready' && opened?.attempts === 0 &&
      /No Data Found/.test(opened?.error_message || ''),
    `${opened?.status}/${opened?.reason_code} attempts=${opened?.attempts} "${opened?.error_message}"`)
  const eid = opened?.event_id
  // Carmen is asked through its preview of the post (decision-log #54), so count previews.
  let p0 = await previews(t0)
  await sweep()
  await sweep()
  rows = pyJson('state')
  let pNow = await previews(t0)
  check('O-03', 'two more sweeps within the hour: no new day, Carmen not asked again',
    daysOf(rows, BU, YESTERDAY).length === 1 && pNow === p0 && dayOf(rows, BU, YESTERDAY)?.reason_code === 'day_not_ready',
    `previews ${p0}→${pNow}`)
  py('backdate', eid, '61', '0')
  p0 = pNow
  await sweep()
  await sleep(3000)
  const again = dayOf(pyJson('state'), BU, YESTERDAY)
  pNow = await previews(t0)
  check('O-04', 'an hour on: Carmen is asked again, still day_not_ready, still no try spent',
    again?.reason_code === 'day_not_ready' && again?.attempts === 0 && pNow === p0 + 1, `previews ${p0}→${pNow} attempts=${again?.attempts}`)
  py('backdate', eid, '61', '25')
  await sweep()
  const gone = await until(rs => {
    const d = dayOf(rs, BU, YESTERDAY)
    return d?.status === 'failed' ? d : null
  }, 30000)
  check('O-05', 'a day on, still no data: failed as day_not_found', gone?.reason_code === 'day_not_found', `${gone?.status}/${gone?.reason_code}`)

  // ── N — HotelTime, reviewable now: its own table, its new rows, the AI (#53) ─────────
  r = await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'hoteltime', auto_post: false })
  const ht0 = pyJson('ht-table')
  const htBlank0 = ht0.blank // Carmen's rows waiting for an account
  const htMapped0 = new Set(ht0.mapped) // keys Carmen's table already has an account for
  const llmN = llmNow()
  r = await hook(keys[`${BU}/hoteltime`], DAY_N)
  const dN = await until(rs => {
    const d = dayOf(rs, BU, DAY_N)
    return d?.status === 'pending_review' ? d : null
  })
  const pN = dN?.payload
  const nKeys = new Set((pN?.rows || []).map(x => x.key)).size
  const nNew = openOf(pN)
  // Keyed as the helper keys the table: the key columns' values joined by "|".
  const keyText = x => (pN?.key_columns || []).map(c => x.values[c] ?? '').join('|')
  const nMappedHere = new Set((pN?.rows || []).map(keyText).filter(k => htMapped0.has(k))).size
  check('N-01', `hook → HotelTime ${DAY_N} parks with its rows keyed HT_Code ← Code, Department blank; every key Carmen's table has no account for is new, the AI asked`,
    r.status === 202 && pN?.preview === true && pN?.databank_id === 171 &&
      JSON.stringify(pN?.key_columns) === '["HT_Code","HT_Description","Department"]' &&
      pN.rows.length > 0 && pN.rows.every(x => x.values.Department === '') && nNew === nKeys - nMappedHere && nNew > 0 &&
      (pN?.flags || []).length > 0 && !dN?.reason_code && llmNow() === llmN + 1,
    `HTTP ${r.status} preview=${pN?.preview} rows=${pN?.rows?.length} keys=${nKeys} mapped in Carmen=${nMappedHere} new=${nNew} ai=${pN?.ai?.length} flags=${pN?.flags}`)

  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    if (!localStorage.getItem('lang')) localStorage.setItem('lang', 'en')
  })
  try {
    await signIn(BU)
    await chip('Review')
    const rowN = (await queueRow(DAY_N).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('N-02', 'the Review tab names the codes to map (the AI\'s, or missing), not "Ready to post"',
      /AI suggested mapping|Mapping missing/i.test(rowN) && !/Ready to post/i.test(rowN), rowN.slice(0, 140))
    await shot('N-02-queue')

    let dialog = await openDay(DAY_N)
    const head = (await dialog.locator('table thead').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
    const pickers = await accountInputs(dialog).count()
    const body = (await dialog.innerText()).replace(/\s+/g, ' ')
    check('N-03', "the dialog is HotelTime's own table: its key columns, a picker per new row, what Approve writes",
      /HT_CODE/i.test(head) && /HT_DESCRIPTION/i.test(head) && /DEPARTMENT/i.test(head) && pickers === nNew &&
        !/rows can't be shown here/.test(body) &&
        new RegExp(`Adds the new rows \\(${nNew}\\) to Carmen's HotelTime mapping`).test(body),
      `head="${head}" pickers=${pickers} AI tags=${await dialog.locator('.pms-tag-ai').count()}`)
    await shot('N-03-dialog')
    await closeDialog()

    // N-08 before Approve: Carmen's engine posts HotelTime now (ask N closed), so a day to
    // reject has to be one that is still parked. Rejecting writes nothing into Carmen's table,
    // so the repeat hook finds the same new keys and asks the AI again.
    dialog = await openDay(DAY_N)
    await dialog.getByRole('button', { name: /^reject$/i }).click()
    await page.getByText('Reject this day?').waitFor({ timeout: 15000 })
    await page.getByPlaceholder('e.g. night audit rerun').fill('E2E: reviewable reject')
    await page.getByRole('button', { name: /^reject day$/i }).click()
    const rej = await until(rs => (dayOf(rs, BU, DAY_N)?.status === 'rejected' ? dayOf(rs, BU, DAY_N) : null), 30000)
    const llm8 = llmNow()
    r = await hook(keys[`${BU}/hoteltime`], DAY_N)
    const back = await until(rs => {
      const d = dayOf(rs, BU, DAY_N)
      return d?.status === 'pending_review' && d?.payload?.preview === true && !d?.reason_code ? d : null
    })
    check('N-08', "Reject → rejected, payload cleared; a repeat hook brings it back with the same new keys, the AI asked again",
      rej?.payload == null && r.status === 200 && !!back && openOf(back.payload) === nNew && llmNow() === llm8 + 1,
      `rejected=${rej?.status} back=${back?.status} new=${openOf(back?.payload)}/${nNew} flags=${back?.payload?.flags}`)

    // ── L — Thai, and a phone (on the parked day, by the dialog's own address) ──────────
    const idN = back?.id
    const direct = async () => {
      await page.goto(`${APP}/#/CreditCardOCR/review?pms=${idN}`)
      await page.reload()
      const d = page.getByRole('dialog').first()
      await d.getByText('HotelTime · Daily', { exact: false }).waitFor({ timeout: 60000 })
      return d
    }
    await page.evaluate(() => localStorage.setItem('lang', 'th'))
    dialog = await direct().catch(() => null)
    const th = dialog ? (await dialog.innerText()).replace(/\s+/g, ' ') : ''
    check('L-01', "in Thai, HotelTime's review reads Thai (its table and Approve)",
      /อนุมัติและโพสต์/.test(th) && /บัญชี/.test(th) && /HT_CODE|HT_Code/i.test(th), th.slice(0, 120))
    await shot('L-01-thai')
    await page.evaluate(() => localStorage.setItem('lang', 'en'))
    await page.setViewportSize({ width: 390, height: 844 })
    dialog = await direct()
    const wide = await page.evaluate(() => document.documentElement.scrollWidth)
    check('L-02', "at 390 px HotelTime's table fits: no sideways scroll",
      wide <= 390 && (await dialog.getByRole('table').count()) > 0, `scrollWidth=${wide}`)
    await shot('L-02-phone')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await closeDialog()

    dialog = await openDay(DAY_N)
    const handN = await fillMissing(dialog)
    await approveIn(dialog).click()
    const outN = await outcome(dialog, DAY_N, 'hoteltime')
    rows = pyJson('state')
    const htAfter = pyJson('ht-table')
    const madeN = pyJson('jvs', DAY_N)
    if (madeN.length) py('void', ...madeN.map(String)) // a real JV: undone at once
    check('N-04', "every new row has an account (the AI's, else by hand) → Approve writes them into Carmen's table, which passes the mapping: Carmen posts, or answers its next fault",
      (outN.posted ||
        (/Carmen didn't post the day/.test(outN.refusal) && !/Mapping is incomplete/.test(outN.refusal) &&
          dayOf(rows, BU, DAY_N)?.reason_code === 'carmen_rejected')) &&
        htAfter.blank === htBlank0 - nNew,
      `by hand=${handN} ${outN.posted ? `posted JV ${outN.posted.jv_no}, voided` : `"${outN.refusal.slice(0, 120)}"`} Carmen's blank rows ${htBlank0}→${htAfter.blank}`)
    await shot('N-04-approved')

    if (outN.posted) {
      r = await hook(keys[`${BU}/hoteltime`], DAY_N)
      await sleep(6000)
      const still = dayOf(pyJson('state'), BU, DAY_N)
      check('N-07', 'a repeat hook for the posted day changes nothing: still posted, with its own JV',
        r.status === 200 && r.json?.duplicate === true && still?.status === 'posted' && String(still?.jv_no) === String(outN.posted.jv_no),
        `HTTP ${r.status} status=${still?.status} jv=${still?.jv_no}`)
    } else {
      await closeDialog()
      dialog = await openDay(DAY_N)
      const banner = (await dialog.locator('.mapping-alert').first().innerText().catch(() => '')).trim()
      const errN = dayOf(pyJson('state'), BU, DAY_N)?.error_message || ''
      check('N-05', "reopened: the banner carries Carmen's own words",
        !!errN && banner.includes(errN.slice(0, 40)), `banner="${banner.slice(0, 120)}"`)
      await page.keyboard.press('Control+Enter')
      const said6 = await alertIn(dialog).catch(() => '')
      check('N-06', "Ctrl+Enter approves; with the accounts in Carmen now, nothing is written and Carmen answers the same",
        /Carmen didn't post the day/.test(said6) && !/Mapping is incomplete/.test(said6), said6.slice(0, 120))
      await closeDialog()
    }

    // ── A — auto-post: any PMS's new rows wait for a person; a mapped day posts ────────
    await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'hoteltime', auto_post: true })
    const llmA = llmNow()
    const pA = await posts(t0)
    r = await hook(keys[`${BU}/hoteltime`], DAY_A1)
    const dA1 = await until(rs => (dayOf(rs, BU, DAY_A1)?.status === 'pending_review' ? dayOf(rs, BU, DAY_A1) : null))
    const pA1 = await posts(t0)
    check('A-01', `auto-post on: the keys of HotelTime ${DAY_A1} that Carmen's table lacks wait for a person (the AI asked); nothing posted`,
      (dA1?.payload?.flags || []).length > 0 && openOf(dA1?.payload) > 0 && pA1 === pA && llmNow() === llmA + 1,
      `new=${openOf(dA1?.payload)} flags=${dA1?.payload?.flags} posts ${pA}→${pA1}`)
    const filledA = pyJson('fill-blank', 'HotelTime.PMS', 'GEN', '1021001') // as in Carmen's screen
    r = await hook(keys[`${BU}/hoteltime`], DAY_A1) // a repeat hook re-reads the day
    const dA2 = await until(rs => {
      const d = dayOf(rs, BU, DAY_A1)
      return d && (d.status === 'posted' || d.reason_code) ? d : null
    }, 120000)
    const madeA = pyJson('jvs', DAY_A1)
    if (madeA.length) py('void', ...madeA.map(String))
    check('A-02', `mapped in Carmen, a repeat hook re-reads ${DAY_A1}: nothing to map, so auto-post sends it; Carmen posts or answers its next fault`,
      r.status === 200 && (dA2?.status === 'posted' || dA2?.reason_code === 'carmen_rejected'),
      `filled=${filledA.filled} ${dA2?.status}/${dA2?.reason_code} "${(dA2?.error_message || '').slice(0, 100)}" JVs=${madeA}`)
    // A-03: with auto-post on, the sweep sends only what is ready and waiting. Nothing is: the
    // days Carmen posted stay posted, and a day it refused is not sent again (no loop).
    const p2 = await posts(t0)
    const sw3 = await sweep()
    await sweep()
    await sweep()
    const p2Now = await posts(t0)
    const madeS = pyJson('jvs', DAY_N, DAY_A1)
    if (madeS.length) py('void', ...madeS.map(String))
    rows = pyJson('state')
    const settled = d => {
      const x = dayOf(rows, BU, d)
      return x?.status === 'posted' || x?.reason_code === 'carmen_rejected'
    }
    check('A-03', `auto-post on, three sweeps: ${DAY_N} and ${DAY_A1} are not sent again (posted stays posted, refused is no loop); no JV`,
      sw3.status === 200 && p2Now === p2 && madeS.length === 0 && settled(DAY_N) && settled(DAY_A1),
      `requeued=${sw3.json?.requeued} posts ${p2}→${p2Now} ${DAY_N}=${dayOf(rows, BU, DAY_N)?.status}/${dayOf(rows, BU, DAY_N)?.reason_code} ${DAY_A1}=${dayOf(rows, BU, DAY_A1)?.status}/${dayOf(rows, BU, DAY_A1)?.reason_code} JVs=${madeS}`)

    // ── R — a repeat hook re-reads a refused day ────────────────────────────────────
    await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'hoteltime', auto_post: false })
    if (dA2?.status === 'posted') {
      check('R-01', `a repeat hook re-reads a refused day (not applicable: Carmen posted ${DAY_A1}, voided)`, true)
    } else {
      r = await hook(keys[`${BU}/hoteltime`], DAY_A1)
      const reread = await until(rs => {
        const d = dayOf(rs, BU, DAY_A1)
        return d?.status === 'pending_review' && !d?.reason_code ? d : null
      })
      check('R-01', 'a repeat hook for a refused day re-reads it: reason cleared, nothing to map, "Ready to post"',
        r.status === 200 && reread?.payload?.preview === true && (reread?.payload?.flags || []).length === 0,
        `${reread?.status}/${reread?.reason_code}`)
    }

    // O-05, seen: the failed opened day under Not posted, with its reason.
    await chip('Not posted')
    const rowGone = (await queueRow(YESTERDAY).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('O-05', 'the failed opened day shows under Not posted, "Data Bank does not have this day"',
      /Data Bank does not have this day/.test(rowGone), rowGone.slice(0, 140))
    await shot('O-05-not-posted')

    // ── CB — Cloudbeds: reviewable too, through Carmen's engine to a JV ──────────────
    // Its day carries the key columns in two lists; `Statistic` is another section, so the
    // rows are `Transaction`'s, keyed Description / MarketSegmentDesc, `Channel` blank (#53).
    await page.setViewportSize({ width: 1440, height: 1000 })
    const cbOn = process.env.PMS_E2E_CB !== '0' // PMS_E2E_CB=0: a rerun that makes no real JV
    const cbListed = real.find(x => String(x.InterfaceName).toLowerCase() === 'cloudbeds' && x.DocType === 'REVENUE')
    const cb0 = cbOn ? pyJson('table', CB) : { rows: -1 }
    cbBase = pyJson('jvs', CB_DAY, CB_DAY2)
    if (cb0.rows === 0) cbSnapped = pyJson('snapshot', CB).rows === 0
    const cbGo = cbOn && check('CB-00', "Carmen's own list has Cloudbeds × GL × REVENUE; its table starts empty (snapshot kept)",
      cbListed?.PostToModule === 'GL' && cbListed?.From === 'CarmenApi' && cbSnapped && !!keys[`${BU}/cloudbeds`],
      `from=${cbListed?.From} rows=${cb0.rows} key=${cb0.key_columns} live JVs before=${cbBase}`)
    if (cbGo) {
      cbRan = true
      await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'cloudbeds', auto_post: false })
      const llmCb = llmNow()
      r = await hook(keys[`${BU}/cloudbeds`], CB_DAY, 'Cloudbeds')
      const dCb = await until(rs => {
        const d = dayOf(rs, BU, CB_DAY, 'cloudbeds')
        return d?.status === 'pending_review' ? d : null
      })
      const pCb = dCb?.payload
      const cbKeys = new Set((pCb?.rows || []).map(x => x.key)).size
      const cbNew = openOf(pCb)
      check('CB-01', `hook → Cloudbeds ${CB_DAY} parks with its Transaction rows (not Statistic), 78 keys all new, the AI asked`,
        r.status === 202 && pCb?.preview === true && pCb?.databank_id === 184 && pCb?.setting_code === CB &&
          JSON.stringify(pCb?.key_columns) === JSON.stringify(cb0.key_columns) && pCb?.rows?.length === 86 &&
          cbKeys === 78 && cbNew === 78 && (pCb?.flags || []).length > 0 && llmNow() === llmCb + 1,
        `HTTP ${r.status} rows=${pCb?.rows?.length} keys=${cbKeys} new=${cbNew} ai=${pCb?.ai?.length} cols=${pCb?.key_columns}`)

      await chip('Review')
      const rowCb = (await queueRow(CB_DAY, 'Cloudbeds').innerText().catch(() => '')).replace(/\s+/g, ' ')
      dialog = await openDay(CB_DAY, 'Cloudbeds')
      const headCb = (await dialog.locator('table thead').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
      const cbPickers = await accountInputs(dialog).count()
      check('CB-02', "the queue names the codes to map; the dialog is Cloudbeds' own table with a picker per new row",
        /AI suggested mapping|Mapping missing/i.test(rowCb) && /MARKETSEGMENTDESC/i.test(headCb) && /CHANNEL/i.test(headCb) &&
          cbPickers === cbNew,
        `row="${rowCb.slice(0, 100)}" head="${headCb}" pickers=${cbPickers}`)
      await shot('CB-02-dialog')

      const handCb = await fillMissing(dialog)
      await approveIn(dialog).click()
      const outCb = await outcome(dialog, CB_DAY, 'cloudbeds')
      const newJvs = pyJson('jvs', CB_DAY).filter(s => !cbBase.includes(s))
      if (outCb.posted) {
        const jv = pyJson('jv', String(outCb.posted.jv_no))
        await chip('Posted')
        const rowP = queueRow(CB_DAY, 'Cloudbeds')
        const textP = (await rowP.innerText().catch(() => '')).replace(/\s+/g, ' ')
        const href = await rowP.getByRole('link', { name: /Open JV/ }).getAttribute('href').catch(() => null)
        check('CB-03', "every new row has an account → Approve writes them into Carmen and Carmen posts the day; the queue shows its JV and Open JV links to it",
          newJvs.length === 1 && String(newJvs[0]) === String(outCb.posted.jv_no) && jv.date === CB_DAY && jv.lines > 0 &&
            jv.dr === jv.cr && textP.includes(String(outCb.posted.jv_no)) && !!href &&
            href.includes(`/glJv/${outCb.posted.jv_no}/show`),
          `by hand=${handCb} ${JSON.stringify(jv)} href=${href}`)
        await shot('CB-03-posted')
        const v = py('void', String(outCb.posted.jv_no))
        const left = pyJson('jvs', CB_DAY).filter(s => !cbBase.includes(s))
        const voided = check('CB-04', `JV ${outCb.posted.jv_no} voided at once; ${CB_DAY}'s live JVs are back to before`,
          v.code === 0 && left.length === 0, `${v.out.trim().split('\n').pop()} left=${left}`)
        if (!voided) throw new Stop(`JV ${outCb.posted.jv_no} could not be voided: void it in Carmen by hand`)
        r = await hook(keys[`${BU}/cloudbeds`], CB_DAY, 'Cloudbeds')
        await sleep(6000)
        const still = dayOf(pyJson('state'), BU, CB_DAY, 'cloudbeds')
        check('CB-06', 'a repeat hook for the posted day changes nothing',
          r.status === 200 && r.json?.duplicate === true && still?.status === 'posted', `HTTP ${r.status} status=${still?.status}`)
      } else {
        const dRef = dayOf(pyJson('state'), BU, CB_DAY, 'cloudbeds')
        check('CB-03', "Approve writes the accounts and Carmen passes the mapping; its next answer shows and becomes the reason",
          !!outCb.refusal && !/Mapping is incomplete/.test(outCb.refusal) && /Carmen didn't post the day/.test(outCb.refusal) &&
            dRef?.reason_code === 'carmen_rejected' && newJvs.length === 0,
          `by hand=${handCb} "${outCb.refusal.slice(0, 160)}" reason=${dRef?.reason_code} new JVs=${newJvs}`)
        if (newJvs.length) py('void', ...newJvs.map(String))
        await shot('CB-03-refused')
      }
      const cbT = pyJson('table', CB, CB_COLS)
      check('CB-05', "Carmen's table holds the day's 78 keys, each with the account Approve wrote",
        cbT.rows === 78 && cbT.blank === 0, `rows=${cbT.rows} blank=${cbT.blank}`)

      // CB-07: a second day with keys of its own, unattended: it waits for a person.
      await closeDialog().catch(() => {})
      const cbBefore = pyJson('table', CB, CB_COLS)
      const tx2 = pyJson('day-keys', 'Cloudbeds', CB_DAY2, 'Transaction', CB_COLS)
      const fresh = tx2.keys.filter(k => !cbBefore.keys.includes(k))
      await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'cloudbeds', auto_post: true })
      const llm7 = llmNow()
      const p7 = await posts(t0)
      r = await hook(keys[`${BU}/cloudbeds`], CB_DAY2, 'Cloudbeds')
      const d2 = await until(rs => {
        const d = dayOf(rs, BU, CB_DAY2, 'cloudbeds')
        return d?.status === 'pending_review' || d?.status === 'posted' ? d : null
      }, 120000)
      const p7Now = await posts(t0)
      const made2 = pyJson('jvs', CB_DAY2).filter(s => !cbBase.includes(s))
      if (made2.length) py('void', ...made2.map(String)) // posted after all: undone at once
      check('CB-07', `auto-post on: ${CB_DAY2}'s ${fresh.length} keys Carmen's table lacks wait for a person (the AI asked); nothing posted`,
        r.status === 202 && d2?.status === 'pending_review' && openOf(d2?.payload) === fresh.length &&
          p7Now === p7 && made2.length === 0 && llmNow() === llm7 + 1,
        `${d2?.status} new=${openOf(d2?.payload)} flags=${d2?.payload?.flags} posts ${p7}→${p7Now} JVs=${made2}`)
      await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'cloudbeds', auto_post: false })
    }
  } finally {
    await browser.close()
  }

  // ── E — hygiene ─────────────────────────────────────────────────────────────────
  check('E-01', 'no uncaught error in the page', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  const log = fs.existsSync(BE_LOG) ? fs.readFileSync(BE_LOG, 'utf8') : ''
  const fives = log.split('\n').filter(l => /\/(pms|carmen\/pms)\//.test(l) && /" 5\d\d /.test(l))
  check('E-02', 'no 5xx from the PMS routes', log && fives.length === 0, fives.slice(0, 3).join(' | ') || (log ? '' : 'no log'))
  const llm1 = llmNow()
  const llmWant = 3 + (cbRan ? 2 : 0) // N-01, N-08's re-read, A-01 (and CB-01, CB-07): the days with new rows
  check('E-03', 'the AI was asked once per day with new rows, and for no other', llm1 === llm0 + llmWant,
    `calls ${llm0}→${llm1}, expected +${llmWant}`)
  const made = pyJson('jvs', ...HT_DAYS, YESTERDAY)
  check('E-04', 'no JV on any HotelTime day or yesterday', made.length === 0, `jvs=${made}`)
  if (made.length) py('void', ...made.map(String))
  const cbLeft = pyJson('jvs', CB_DAY, CB_DAY2).filter(s => !cbBase.includes(s))
  check('E-05', 'no JV of this run left live on the Cloudbeds days', cbLeft.length === 0, `left=${cbLeft} before=${cbBase}`)
  if (cbLeft.length) py('void', ...cbLeft.map(String))
}

async function teardown() {
  const restored = py('ht-restore')
  check('T-01', "HotelTime's table is the snapshot", restored.code === 0, restored.out.trim().split('\n').pop())
  if (cbSnapped) {
    const cbBack = py('restore', CB)
    check('T-04', "Cloudbeds' table is empty again, as this run found it", cbBack.code === 0,
      `${cbBack.out.trim().split('\n').pop()} ${cbBack.code ? cbBack.err.trim().split('\n').pop() : ''}`)
  }
  for (const [bu, pms] of [[BU, 'hoteltime'], [BU, 'comanche'], [BU_B, 'hoteltime'], [BU, 'cloudbeds']]) {
    if (pms !== 'comanche') await carmenApi('PUT', '/settings', { uri: URI, bu, pms, auto_post: false })
    const r = await carmenApi('DELETE', `/keys?${new URLSearchParams({ uri: URI, bu, pms })}`)
    check('T-02', `auto-post off, key revoked: ${bu} × ${pms}`, r.status === 204 || r.status === 404, `HTTP ${r.status}`)
  }
  setSwitch({ mode: 'real' })
  check('T-03', 'the interface list is Carmen\'s own again', JSON.parse(fs.readFileSync(SWITCH, 'utf8')).mode === 'real')
}

try {
  await run()
} catch (e) {
  check('STOP', e instanceof Stop ? e.message : `crashed: ${e.stack || e}`, false)
} finally {
  try {
    await teardown()
  } catch (e) {
    check('T-xx', `teardown crashed: ${e.message}`, false)
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1))
  const failed = results.filter(r => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}
