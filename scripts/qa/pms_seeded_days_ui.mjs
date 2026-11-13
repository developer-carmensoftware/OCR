// PMS days that arrive the two ways, with real data re-dated into Carmen dev's Data Bank (the
// plan of 2026-11-13): Carmen hooks us (`From: CarmenApi`), or nothing hooks and our cron opens
// the day (the 06:00 sweep, #55). Each PMS's review modal in the browser, the AI's picks, writing
// Carmen's mapping and posting a JV. Data half: pms_seeded_days_e2e.py (seeds from carmencloud's
// own days, `pms_databank.py export`, kept outside the repo in PMS_TEST_DATA).
//
//   node scripts/qa/pms_seeded_days_ui.mjs
//
// S setup · W yesterday through the sweep (data ready before it; data late) · F `From`: a PMS our
// stub lists as PartnerApi goes by date alone until Carmen holds its day, then by the row's id ·
// H the hook with fresh dates (repeat, night audit run twice) · I the AI · M each PMS's review modal
// (Comanche, HotelTime, Cloudbeds) · P Approve: Carmen's table written, the JV posted and voided ·
// A auto-post · E hygiene · T teardown (always).
//
// Needs the stack of pms_post_checks_ui.mjs: the branch backend started afresh by
// scripts/qa/pms_backend_stub.py (it also logs every body sent to Carmen's engine), vite on 3011,
// local Supabase. Run after 06:00 ICT. backend/.env: a working menu token in CARMEN_AUTHORIZATION,
// a fresh web JWT in CARMEN_ADMIN_TOKEN (JVs are read and voided with it).
// **Carmen dev writes:** Data Bank rows (reserved dates are deleted at teardown; yesterday's are
// kept, since QA's own sweep reads them too); the three mapping tables (snapshot, restored row for
// row); JVs, each voided at once. Expect 3–4 JVs.
// Carmen dev, learned 2026-11-13: posting a day Carmen already holds replaces that row (same Id),
// and its DELETE fails for Comanche and Cloudbeds rows ("not a valid Base-64 string"), so those
// rows stay; a later run re-uses them, since a seed onto a held date replaces the content.

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, '.playwright-mcp/pms-seeded')
const SWITCH = path.join(ROOT, '.playwright-mcp/pms-pc/interfaces.json')
const DATA = process.env.PMS_TEST_DATA || path.join(os.homedir(), 'Documents/bruno/Test-Pms-Data')
const APP = process.env.APP_URL || 'http://localhost:3011'
const API = process.env.API_URL || 'http://127.0.0.1:8011'
const PY = process.env.PYTHON || path.join(ROOT, 'backend/venv/Scripts/python.exe')
const HELPER = path.join(ROOT, 'scripts/qa/pms_seeded_days_e2e.py')
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

// The three PMSs: Carmen's setting code, how the helper keys its table, and the source days.
const PMS = {
  comanche: { name: 'Comanche', setting: 'Comanche.PMS', cols: '' },
  hoteltime: { name: 'HotelTime', setting: 'HotelTime.PMS', cols: '' },
  cloudbeds: { name: 'Cloudbeds', setting: 'Cloudbeds.PMS', cols: 'Description,MarketSegmentDesc' },
}
// Reserved hook dates: no tester uses them, and no sweep opens them.
const R = { co: '2026-08-03', ht1: '2026-08-05', ht2: '2026-08-06', cb: '2026-08-08' }
const SRC = {
  co: '2024-09-07', // Comanche: Room Charge (Manual) 101, Ice 301, Miscellaneous 701 appear
  co2: '2024-09-08', // the night audit run again: a second Data Bank row for R.co (H-03)
  ht1: '2026-10-05',
  ht2: '2026-10-06', // shares most keys with ht1: Approve on ht1 shrinks its new rows (P-02)
  cb: '2026-10-26',
  yCo: '2024-09-09',
  yHt: '2026-10-04',
  yCb: '2026-10-29',
}
const ict = new Date(Date.now() + 7 * 3600e3)
const YESTERDAY = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), ict.getUTCDate() - 1))
  .toISOString()
  .slice(0, 10)

const results = []
const pageErrors = []
const jvs = [] // every JV this run made: voided at once, and again at teardown if that failed
let postsExpected = 0
let snapped = false // teardown restores the tables only once they were kept
let page
let context

function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? `  (${detail})` : ''}`)
  return Boolean(ok)
}
function na(id, name, why) {
  results.push({ id, name, ok: true, na: true, detail: why })
  console.log(`N/A  ${id} ${name}  (${why})`)
}
class Stop extends Error {}
const sleep = ms => new Promise(r => setTimeout(r, ms))

function py(...args) {
  const r = spawnSync(PY, ['-X', 'utf8', HELPER, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' }
}
function pyJson(...args) {
  const r = py(...args)
  if (r.code !== 0) throw new Error(`helper ${args[0]} failed: ${r.err.slice(-500)}`)
  return JSON.parse(r.out.trim().split('\n').pop())
}
const dayOf = (rows, date, pms) =>
  rows.find(r => r.bu === BU && r.event_id.toLowerCase() === `pms/${pms}/daily/${date}`)
const countOf = (rows, date, pms) =>
  rows.filter(r => r.bu === BU && r.event_id.toLowerCase() === `pms/${pms}/daily/${date}`).length
async function until(pred, ms = 120000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const hit = pred(pyJson('state'))
    if (hit) return hit
    await sleep(2500)
  }
  return null
}
const parked = (date, pms, extra = () => true) =>
  until(rs => {
    const d = dayOf(rs, date, pms)
    return d?.status === 'pending_review' && extra(d) ? d : null
  })

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
const keys = {}
const hook = (pms, date) =>
  http('POST', `${API}/api/v1/pms/events`, {
    headers: { Authorization: `Bearer ${keys[pms]}` },
    body: { InterfaceType: 'PMS', InterfaceName: PMS[pms].name, DocType: 'Daily', DocDate: date },
  })
const sweep = () => http('POST', `${API}/api/v1/pms/process/run`, { headers: { Authorization: `Bearer ${JOB}` } })
const autoPost = (pms, on) => carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms, auto_post: on })
const setSwitch = mode => {
  fs.mkdirSync(path.dirname(SWITCH), { recursive: true })
  fs.writeFileSync(SWITCH, JSON.stringify(mode))
}
const seed = (pms, src, date, ...flags) => pyJson('seed', PMS[pms].name, src, date, ...flags).id
const engineCalls = () => pyJson('engine-calls')
const tableOf = pms => pyJson('table', PMS[pms].setting, ...(PMS[pms].cols ? [PMS[pms].cols] : []))
const llmNow = () => Number(py('llm').out.trim().split('\n').pop())
async function postsSince(since) {
  await sleep(11000) // the outbound log is written every 10 s
  return Number(py('posts-since', since).out.trim().split('\n').pop())
}
const openOf = p => (p?.missing?.length || 0) + (p?.ai?.length || 0)
const keysOf = p => new Set((p?.rows || []).map(r => r.key))
const dmy = iso => iso.split('-').reverse().join('/')
/** The source day's biggest amounts, as the file has them and as a screen would format them. */
function amountsOf(pms, src) {
  const fd = JSON.parse(fs.readFileSync(path.join(DATA, PMS[pms].name, `${src}.json`), 'utf8')).FileData
  const list = Object.values(fd).find(v => Array.isArray(v) && v[0] && 'Amount' in v[0]) || []
  return list
    .map(x => Number(x.Amount))
    .filter(n => Math.abs(n) >= 1000)
    .sort((a, b) => Math.abs(b) - Math.abs(a))
    .slice(0, 3)
    .flatMap(n => [n.toFixed(2), n.toLocaleString('en-US', { minimumFractionDigits: 2 })])
}

async function shot(name) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`) }) // the viewport: the modal is fixed
}
async function signIn() {
  if (page) await page.close()
  page = await context.newPage()
  page.on('pageerror', err => pageErrors.push(String(err)))
  await page.goto(`${APP}/#/CreditCardOCR?${new URLSearchParams({ token: CARMEN, bu: BU, uri: URI })}`)
  const heading = page.getByText(/AI JV Automation|ระบบ/).first()
  const consent = page.locator('.uc-confirm-btn')
  await Promise.race([heading.waitFor({ timeout: 60000 }), consent.waitFor({ timeout: 60000 })])
  await page.waitForTimeout(1500)
  if (await consent.isVisible()) {
    await page.locator('input[type="checkbox"]').first().check()
    await consent.click()
  }
  await page.waitForTimeout(1500)
}
async function reviewTab() {
  await page.goto(`${APP}/#/CreditCardOCR`)
  await page.reload()
  const tab = page.getByRole('tab').first()
  await tab.waitFor({ timeout: 30000 })
  await tab.click()
  await page.waitForTimeout(1500)
}
const queueRow = (date, name) => page.getByRole('row').filter({ hasText: dmy(date) }).filter({ hasText: `${name} · Daily` })
async function openDay(date, pms) {
  await reviewTab()
  await queueRow(date, PMS[pms].name).getByRole('button').first().click()
  const dialog = page.getByRole('dialog').first()
  await dialog.waitFor({ timeout: 30000 })
  await dialog.locator('table tbody tr').first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(800)
  return dialog
}
const accountInputs = dialog => dialog.locator('input[aria-label^="Account for "], input[aria-label^="Account ของ "]')
const approveIn = dialog => dialog.getByRole('button', { name: /approve and post/i })
async function panelCodes() {
  const option = page.locator('.css-select-panel [role="button"]:not([aria-disabled="true"])')
  await option.first().waitFor({ timeout: 10000 })
  const texts = await option.allInnerTexts()
  return texts.map(t => t.trim().split(/\s+/)[0])
}
async function pick(input, code) {
  const option = page.locator('.css-select-panel [role="button"]:not([aria-disabled="true"])')
  for (let tries = 0; ; tries++) {
    await input.scrollIntoViewIfNeeded()
    await input.click()
    await input.fill(code)
    if (await option.first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) break
    await input.press('Escape').catch(() => {})
    if (tries) throw new Stop(`no option for ${code} in ${await input.getAttribute('aria-label')}`)
  }
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
    const d = dayOf(pyJson('state'), date, pms)
    if (d?.status === 'posted') return { posted: d, refusal: '' }
    const alert = dialog.getByRole('alert').first()
    if (await alert.isVisible().catch(() => false)) return { posted: null, refusal: (await alert.innerText()).trim() }
  }
  return { posted: null, refusal: '' }
}
async function closeDialog() {
  await page.keyboard.press('Escape')
  const leave = page.getByRole('dialog').filter({ hasText: /Leave without posting\?|ออกโดยไม่/ })
  if (await leave.waitFor({ timeout: 3000 }).then(() => true).catch(() => false))
    await leave.getByRole('button').filter({ hasText: /Discard|ทิ้ง/ }).click()
}
/** Read a JV, then void it at once (Carmen dev keeps no JV of ours). */
function readAndVoid(seq) {
  jvs.push(String(seq))
  const jv = pyJson('jv', String(seq))
  const v = py('void', String(seq))
  if (v.code === 0) jvs.splice(jvs.indexOf(String(seq)), 1)
  return { jv, voided: v.code === 0 }
}

// ── M — one PMS's review modal ─────────────────────────────────────────────────────────
async function modal(pms, date, src, special) {
  const n = PMS[pms].name
  const d = dayOf(pyJson('state'), date, pms)
  const p = d?.payload
  await reviewTab()
  const row = (await queueRow(date, n).innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(`M-${n}-1`, `${n}: the queue row reads PMS ${dmy(date)} · ${n} · Daily and names the codes to map`,
    row.includes(dmy(date)) && /AI suggested mapping|Mapping missing/.test(row), row.slice(0, 160))

  let dialog = await openDay(date, pms)
  const head = (await dialog.locator('table thead th').allInnerTexts()).map(t => t.trim().toLowerCase()).filter(Boolean)
  const want = [...(p?.key_columns || []), 'DeptCode', 'AccCode', 'AccDesc'].map(c => c.toLowerCase())
  check(`M-${n}-2`, `${n}: the columns are Carmen's mapping table's, in its order, then DeptCode · AccCode · AccDesc`,
    want.every((c, i) => head[i] === c), `head=${head.join(' | ')}`)

  const body = (await dialog.innerText()).replace(/\s+/g, ' ')
  const shown = amountsOf(pms, src).filter(a => body.includes(a))
  check(`M-${n}-3`, `${n}: no amount, no Dr/Cr anywhere in the review`,
    !/\bAmount\b/.test(body) && shown.length === 0, shown.join(', '))

  const trs = await dialog.locator('table tbody tr').count()
  const pickers = await accountInputs(dialog).count()
  const nKeys = keysOf(p).size
  check(`M-${n}-4`, `${n}: one row per key (${nKeys}); a picker for each new row (${openOf(p)}), Carmen's rows as text`,
    trs === nKeys && pickers === openOf(p), `rows=${trs} keys=${nKeys} pickers=${pickers} new=${openOf(p)}`)

  const tags = await dialog.locator('.pms-tag-ai').count()
  const bad = pyJson('picks').find(x => x.event_id.toLowerCase() === d.event_id.toLowerCase())?.bad || ['?']
  const firstNew = await dialog.locator('table tbody tr').first().locator('input').count()
  check(`M-${n}-5`, `${n}: new rows first; every AI pick tagged AI, each in the chart and allowed by its department`,
    firstNew > 0 && tags === (p?.ai?.length || 0) && bad.length === 0, `AI tags=${tags}/${p?.ai?.length} refused picks=${bad.length}`)

  // M-6/7/8: a department that limits its accounts filters the account list, clears an account
  // it does not allow (Approve then blocks), and closing with that change asks first.
  const r103 = pyJson('restricted')
  const allowedSet = new Set(r103.allowed)
  // The new row to change: an AI pick in another department, best one whose account that
  // department does not allow (so the change also clears it).
  const accsAll = accountInputs(dialog)
  let acc0 = accsAll.first()
  let label = (await acc0.getAttribute('aria-label')).slice('Account for '.length)
  let rowAt = 0
  let fallback = null
  for (let i = 0; i < Math.min(12, await accsAll.count()); i++) {
    const a = accsAll.nth(i)
    const l = (await a.getAttribute('aria-label')).slice('Account for '.length)
    const dv = (await dialog.getByLabel(`Dept for ${l}`, { exact: true }).inputValue()).trim().split(/\s+/)[0]
    const av = (await a.inputValue()).trim().split(/\s+/)[0]
    if (!dv || dv === r103.dept) continue
    if (!allowedSet.has(av)) {
      acc0 = a
      label = l
      rowAt = i
      fallback = null
      break
    }
    fallback ??= { a, l, i }
  }
  if (fallback) ({ a: acc0, l: label, i: rowAt } = fallback)
  const rowOf = dialog.locator('table tbody tr').nth(rowAt)
  const wasAi = (await rowOf.locator('.pms-tag-ai').count()) > 0
  if (r103.dept) try {
    const deptIn = dialog.getByLabel(`Dept for ${label}`, { exact: true })
    const before = (await acc0.inputValue()).trim().split(/\s+/)[0]
    await pick(deptIn, r103.dept)
    await page.waitForTimeout(400)
    const after = (await acc0.inputValue()).trim()
    await acc0.click()
    const codes = await panelCodes().catch(() => [])
    await acc0.press('Escape')
    const allowed = allowedSet
    const cleared = !allowed.has(before)
    check(`M-${n}-6`, `${n}: department ${r103.dept} lists only the accounts it allows, and drops one it does not`,
      codes.length > 0 && codes.every(c => allowed.has(c)) && (!cleared || after === ''),
      `options=${codes.length} all allowed=${codes.every(c => allowed.has(c))} before=${before} after="${after}"`)
    const blocked = (await dialog.innerText()).includes('Pick an account for every new row.')
    check(`M-${n}-7`, `${n}: a new row without an account blocks Approve and says so`,
      !cleared || (blocked && (await approveIn(dialog).isDisabled())), `cleared=${cleared} blocked=${blocked}`)
    await page.keyboard.press('Escape')
    const leave = page.getByRole('dialog').filter({ hasText: 'Leave without posting?' })
    const asked = await leave.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)
    if (asked) await leave.getByRole('button', { name: /keep reviewing/i }).click()
    const stillOpen = await dialog.isVisible()
    const undo = dialog.getByRole('button', { name: `Undo ${label}` })
    let restored = true
    if (wasAi && (await undo.count())) {
      await undo.click()
      await page.waitForTimeout(300)
      restored = (await acc0.inputValue()).trim().startsWith(before) && (await dialog.locator('.pms-tag-ai').count()) === tags
    }
    check(`M-${n}-8`, `${n}: closing with a change asks first, Keep reviewing keeps it; Undo puts the AI's pick back`,
      asked && stillOpen && restored, `asked=${asked} open=${stillOpen} wasAI=${wasAi} restored=${restored}`)
  } catch (e) {
    check(`M-${n}-6`, `${n}: department filter, blocked Approve, leave prompt, Undo`, false, String(e.message || e).slice(0, 200))
    await page.keyboard.press('Escape').catch(() => {})
  } else {
    na(`M-${n}-6`, 'department filter', 'no department limits its accounts in this chart')
  }
  if (special) await special(dialog, body, head, p)
  await shot(`M-${n}-1440-light`)
  await closeDialog()

  // M-9: dark, Thai, a phone.
  const shots = []
  for (const [tag, setup] of [
    ['dark', () => localStorage.setItem('theme', 'dark')],
    ['th', () => localStorage.setItem('lang', 'th')],
  ]) {
    await page.evaluate(setup)
    dialog = await openDay(date, pms)
    await shot(`M-${n}-${tag}`)
    shots.push(tag)
    await closeDialog()
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light')
      localStorage.setItem('lang', 'en')
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  dialog = await openDay(date, pms)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await shot(`M-${n}-390`)
  await closeDialog()
  await page.setViewportSize({ width: 1440, height: 1000 })
  check(`M-${n}-9`, `${n}: dark, Thai and 390 px render (shots), no sideways page scroll on a phone`,
    shots.length === 2 && overflow <= 1, `overflow=${overflow}px`)
}

async function run() {
  const t0 = new Date().toISOString()
  // ── S — setup ─────────────────────────────────────────────────────────────────────────
  if (ict.getUTCHours() < 6) throw new Stop('run after 06:00 ICT: the sweep opens yesterday only from then')
  const real = pyJson('interfaces')
  const rev = n => real.find(r => String(r.InterfaceName).toLowerCase() === n && r.DocType === 'REVENUE')
  check('S-01', "Carmen lists Comanche, HotelTime and Cloudbeds: From CarmenApi, PostType Json, REVENUE and STATISTIC",
    Object.keys(PMS).every(n => rev(n)?.From === 'CarmenApi' && rev(n)?.PostType === 'Json' &&
      real.some(r => String(r.InterfaceName).toLowerCase() === n && r.DocType === 'STATISTIC')),
    Object.keys(PMS).map(n => `${n}:${rev(n)?.From}/${rev(n)?.PostType}`).join(' '))
  const jv0 = py('jv', '1618')
  if (!check('S-02', 'the web JWT reads a JV (JVs are voided with it)', jv0.code === 0, jv0.err.slice(-120)))
    throw new Stop('no web JWT: P and A would leave live JVs')
  const liveBefore = pyJson('jvs', R.co, R.ht1, R.ht2, R.cb) // Carmen's own, e.g. 970 (ACSC)
  const snaps = Object.values(PMS).map(x => pyJson('snapshot', x.setting).rows)
  snapped = true
  check('S-03', "Carmen's three mapping tables kept, to put back row for row", snaps.every(n => n >= 0), snaps.join('/'))
  // HotelTime is yesterday's late PMS (no data at the first sweep): a row a run of ours kept is
  // cleared first (HotelTime rows delete); anyone else's stops the run. Comanche and Cloudbeds
  // use the day Carmen holds, or get one. Reserved dates may hold our rows: a seed replaces them.
  let heldY = Object.fromEntries(Object.keys(PMS).map(pms => [pms, pyJson('held', PMS[pms].name, YESTERDAY)[YESTERDAY]]))
  if (heldY.hoteltime.length) py('unseed-day', 'HotelTime', YESTERDAY)
  heldY = { ...heldY, hoteltime: pyJson('held', 'HotelTime', YESTERDAY)[YESTERDAY] }
  check('S-04', `yesterday (${YESTERDAY}): HotelTime has no Data Bank row (the late day); Comanche and Cloudbeds hold one or get one`,
    heldY.hoteltime.length === 0, `Comanche ${JSON.stringify(heldY.comanche)} Cloudbeds ${JSON.stringify(heldY.cloudbeds)}`)
  if (heldY.hoteltime.length) throw new Stop("HotelTime's yesterday holds a row this suite did not seed")
  py('reset')
  py('engine-reset')
  setSwitch({ mode: 'real' })
  for (const pms of Object.keys(PMS)) {
    const r = await carmenApi('POST', '/keys', { uri: URI, bu: BU, pms })
    keys[pms] = r.json?.api_key
    await autoPost(pms, false)
  }
  check('S-05', `${BU} has a live key for each PMS, auto-post off`, Object.values(keys).every(Boolean))

  // ── W/F — yesterday, with no hook: the sweep opens it (cron) ─────────────────────────────
  // Comanche and Cloudbeds: Carmen holds the day before the sweep (data ready, W-01). HotelTime,
  // listed by our stub as PartnerApi: no row yet, so it goes by date alone (F-01) and waits
  // (W-02); its data then arrives late and the next hourly read finds it.
  setSwitch({ mode: 'list', rows: real.map(r => (String(r.InterfaceName).toLowerCase() === 'hoteltime' && r.DocType === 'REVENUE' ? { ...r, From: 'PartnerApi' } : r)) })
  const coY = heldY.comanche.length ? Math.max(...heldY.comanche) : seed('comanche', SRC.yCo, YESTERDAY, '--keep')
  const cbY = heldY.cloudbeds.length ? Math.max(...heldY.cloudbeds) : seed('cloudbeds', SRC.yCb, YESTERDAY, '--keep')
  let r = await sweep()
  const s1 = await until(rs => {
    const co = dayOf(rs, YESTERDAY, 'comanche')
    const ht = dayOf(rs, YESTERDAY, 'hoteltime')
    const cb = dayOf(rs, YESTERDAY, 'cloudbeds')
    return co?.status === 'pending_review' && cb?.status === 'pending_review' && ht?.reason_code === 'day_not_ready' ? { co, ht, cb } : null
  })
  check('W-01', `no hook: the sweep opens yesterday; Comanche's and Cloudbeds' data was there, so each parks with its row (${coY}, ${cbY})`,
    r.status === 200 && s1?.co?.payload?.databank_id === coY && s1?.cb?.payload?.databank_id === cbY,
    `Comanche ${s1?.co?.status} databank=${s1?.co?.payload?.databank_id} ai=${s1?.co?.payload?.ai?.length} · Cloudbeds databank=${s1?.cb?.payload?.databank_id} ai=${s1?.cb?.payload?.ai?.length}`)
  check('W-02', 'HotelTime has no data yet: day_not_ready, still received, no try spent',
    s1?.ht?.status === 'received' && s1?.ht?.attempts === 0, `${s1?.ht?.status}/${s1?.ht?.reason_code} attempts=${s1?.ht?.attempts}`)
  const htCalls = () => engineCalls().filter(c => /^hoteltime\.pms$/i.test(c.body.Code) && c.body.DateFrom === YESTERDAY)
  const f1 = htCalls()
  check('F-01', 'HotelTime listed as PartnerApi, no Data Bank row: the preview goes by date alone (no id), Carmen has nothing, day_not_ready',
    s1?.ht?.status === 'received' && f1.length > 0 && f1.every(c => !('id' in c.body)),
    `${s1?.ht?.status}/${s1?.ht?.reason_code} calls=${f1.length} bodies=${JSON.stringify(f1.map(c => c.body))}`)

  const htY = seed('hoteltime', SRC.yHt, YESTERDAY, '--keep')
  py('engine-reset')
  py('backdate', s1.ht.event_id, '61', '0')
  r = await sweep()
  const s2 = await parked(YESTERDAY, 'hoteltime')
  check('W-02', `the data arrives (row ${htY}); an hour on, the sweep reads it and the day parks; no try was spent waiting`,
    s2?.payload?.databank_id === htY && (s2?.attempts ?? 9) <= 1, `databank=${s2?.payload?.databank_id} attempts=${s2?.attempts}`)
  const f2 = htCalls()
  check('F-02', `Carmen now holds HotelTime's day: the preview carries its row id (${htY}) and the day parks, PartnerApi or not`,
    f2.some(c => JSON.stringify(c.body.id) === JSON.stringify([htY])), `bodies=${JSON.stringify(f2.map(c => c.body))}`)
  setSwitch({ mode: 'real' })
  r = await hook('hoteltime', YESTERDAY)
  await sleep(3000)
  const s3 = await parked(YESTERDAY, 'hoteltime', d => d.payload?.databank_id === htY)
  const sameRows = s3 && [...keysOf(s3.payload)].sort().join() === [...keysOf(s2?.payload)].sort().join()
  check('F-03', 'listed as CarmenApi again, a hook re-reads the same day: the same rows and new keys, so From changes nothing of ours',
    r.status === 200 && r.json?.duplicate === true && sameRows && openOf(s3?.payload) === openOf(s2?.payload),
    `HTTP ${r.status} duplicate=${r.json?.duplicate} rows same=${sameRows} new ${openOf(s2?.payload)}→${openOf(s3?.payload)}`)
  check('W-03', 'a hook after the sweep opened the day stores no second day', countOf(pyJson('state'), YESTERDAY, 'hoteltime') === 1)

  // ── H — the hook, with fresh dates (Carmen holds the day, then hooks) ────────────────────
  const ids = {
    co: seed('comanche', SRC.co, R.co, '--again'),
    ht1: seed('hoteltime', SRC.ht1, R.ht1, '--again'),
    ht2: seed('hoteltime', SRC.ht2, R.ht2, '--again'),
    cb: seed('cloudbeds', SRC.cb, R.cb, '--again'),
  }
  py('engine-reset')
  const hk = []
  for (const [k, pms] of [['co', 'comanche'], ['ht1', 'hoteltime'], ['ht2', 'hoteltime'], ['cb', 'cloudbeds']])
    hk.push((await hook(pms, R[k])).status)
  const H = {}
  for (const [k, pms] of [['co', 'comanche'], ['ht1', 'hoteltime'], ['ht2', 'hoteltime'], ['cb', 'cloudbeds']])
    H[k] = await parked(R[k], pms, d => d.payload?.databank_id === ids[k])
  const tables = Object.fromEntries(Object.keys(PMS).map(pms => [pms, tableOf(pms)]))
  const colsOk = H.co?.payload?.key_columns?.join() === tables.comanche.key_columns.join() &&
    H.ht1?.payload?.key_columns?.join() === tables.hoteltime.key_columns.join() &&
    H.cb?.payload?.key_columns?.join() === tables.cloudbeds.key_columns.join()
  const withId = engineCalls().filter(c => c.call === 'preview')
  check('H-01', "hook → 202 → each day parks with its own Data Bank row, keyed by its own table's columns; the preview carried that row's id",
    hk.every(s => s === 202) && Object.values(H).every(Boolean) && colsOk &&
      Object.entries(ids).every(([, id]) => withId.some(c => JSON.stringify(c.body.id) === JSON.stringify([id]))),
    `HTTP ${hk.join(',')} parked=${Object.values(H).filter(Boolean).length}/4 cols=${colsOk} ids=${JSON.stringify(ids)}`)
  r = await hook('comanche', R.co)
  await sleep(4000)
  check('H-02', 'the same hook again: 200 duplicate, still one day', r.status === 200 && r.json?.duplicate === true &&
    countOf(pyJson('state'), R.co, 'comanche') === 1, `HTTP ${r.status}`)
  const co2 = seed('comanche', SRC.co2, R.co, '--again')
  r = await hook('comanche', R.co)
  const H3 = await parked(R.co, 'comanche', d => d.payload?.databank_id === co2)
  check('H-03', `the night audit run again: Carmen replaces the day's row in place (Id ${ids.co} → ${co2}), and a repeat hook reads its new rows`,
    !!H3 && co2 === ids.co && [...keysOf(H3.payload)].sort().join() !== [...keysOf(H.co?.payload)].sort().join(),
    `databank=${H3?.payload?.databank_id} keys ${keysOf(H.co?.payload).size}→${keysOf(H3?.payload).size}`)

  // ── I — the AI ────────────────────────────────────────────────────────────────────────
  const allPicks = pyJson('picks').filter(x => x.bu === BU)
  check('I-01', 'every parked day: the AI picked, and no pick is one Carmen would refuse',
    allPicks.length >= 6 && allPicks.every(x => x.bad.length === 0),
    allPicks.map(x => `${x.event_id.split('/').slice(1).join('/')}: ai=${x.ai} blank=${x.missing}`).join(' · '))
  const llm0 = llmNow()
  if (!(s3?.payload?.ai?.length)) throw new Stop('I-02 needs an AI pick on HotelTime yesterday')
  const bl = pyJson('blank-one', s3.event_id)
  r = await sweep()
  const asked = await until(rs => {
    const d = dayOf(rs, YESTERDAY, 'hoteltime')
    return d?.payload?.ai_retries === 1 ? d : null
  }, 90000)
  check('I-02', `a row left blank (${bl.key.slice(0, 40)}…) is asked again by the next sweep: ai_retries 1, the AI called, only for that row`,
    !!asked && llmNow() > llm0 && (asked.payload.missing?.length || 0) <= 1,
    `retries=${asked?.payload?.ai_retries} blank now=${asked?.payload?.missing?.length} llm +${llmNow() - llm0}`)

  // ── M — each PMS's review modal (browser) ───────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    if (!localStorage.getItem('lang')) localStorage.setItem('lang', 'en')
  })
  try {
    await signIn()
    await modal('comanche', R.co, SRC.co2, async (dialog, body) => {
      check('M-Comanche-x', 'Comanche: codes that are words (Guest Ledger, Deposit Ledger) show as keys',
        /Guest Ledger/.test(body) && /Deposit Ledger/.test(body))
    })
    await modal('hoteltime', R.ht1, SRC.ht1, async (dialog, body, head, p) => {
      check('M-HotelTime-x', 'HotelTime: the Department column is there and blank on every row (its rows come from Revenue)',
        head.includes('department') && (p?.rows || []).every(x => x.values.Department === ''))
    })
    await modal('cloudbeds', R.cb, SRC.cb, async (dialog, body, head) => {
      check('M-Cloudbeds-x', 'Cloudbeds: MarketSegmentDesc and Channel columns, no Statistic rows',
        head.includes('marketsegmentdesc') && head.includes('channel') && !/TOTAL ROOM|ROOM OCCUPIED/i.test(body))
    })

    // ── P — Approve: Carmen's table written, the JV posted (and voided at once) ────────────
    let since = new Date().toISOString()
    const ht2Before = openOf(dayOf(pyJson('state'), R.ht2, 'hoteltime')?.payload)
    const htT0 = tableOf('hoteltime')
    const newHt1 = openOf(dayOf(pyJson('state'), R.ht1, 'hoteltime')?.payload)
    let dialog = await openDay(R.ht1, 'hoteltime')
    const filled = await fillMissing(dialog)
    await approveIn(dialog).click()
    postsExpected++
    let out = await outcome(dialog, R.ht1, 'hoteltime')
    const htT1 = tableOf('hoteltime')
    const dayKeys = (H.ht1?.payload?.rows || []).map(x => (H.ht1.payload.key_columns || []).map(c => x.values[c] ?? '').join('|'))
    const kept = htT0.keys.every(k => htT1.keys.includes(k))
    const mappedAll = dayKeys.every(k => htT1.mapped.includes(k))
    let v = out.posted?.jv_no ? readAndVoid(out.posted.jv_no) : null
    check('P-01', `HotelTime ${R.ht1}: Approve writes the whole table (every old key kept, the day's ${newHt1} new keys mapped), Carmen posts, the JV balances, voided`,
      !!out.posted && kept && mappedAll && htT1.rows >= htT0.rows && v?.jv?.date === R.ht1 && v?.jv?.lines > 0 && v?.jv?.dr === v?.jv?.cr && v?.voided,
      `filled by hand=${filled} table rows ${htT0.rows}→${htT1.rows} kept=${kept} day mapped=${mappedAll} jv=${out.posted?.jv_no} lines=${v?.jv?.lines} dr=${v?.jv?.dr} cr=${v?.jv?.cr} voided=${v?.voided} ${out.refusal}`)
    const ht2After = openOf(dayOf(pyJson('state'), R.ht2, 'hoteltime')?.payload)
    check('P-02', `recheck: ${R.ht2}'s new rows shrink by the keys just approved (${ht2Before}→${ht2After})`, ht2After < ht2Before)

    dialog = await openDay(R.cb, 'cloudbeds')
    await fillMissing(dialog)
    await approveIn(dialog).click()
    postsExpected++
    out = await outcome(dialog, R.cb, 'cloudbeds')
    v = out.posted?.jv_no ? readAndVoid(out.posted.jv_no) : null
    check('P-03', `Cloudbeds ${R.cb}: Approve → a JV (voided) or Carmen's own words in the dialog, the day still parked`,
      (out.posted && v?.voided && v?.jv?.dr === v?.jv?.cr) || (!out.posted && out.refusal.length > 0),
      out.posted ? `jv=${out.posted.jv_no} lines=${v?.jv?.lines} voided=${v?.voided}` : out.refusal.slice(0, 160))
    if (!out.posted) await closeDialog()

    dialog = await openDay(R.co, 'comanche')
    await fillMissing(dialog)
    await approveIn(dialog).click()
    postsExpected++
    out = await outcome(dialog, R.co, 'comanche')
    v = out.posted?.jv_no ? readAndVoid(out.posted.jv_no) : null
    const kFixed = !!out.posted
    check('P-04', `Comanche ${R.co}: Approve → Carmen refuses (ask K) and says why, the day stays parked, no JV — or, K fixed, a JV voided`,
      (!out.posted && out.refusal.length > 0 && dayOf(pyJson('state'), R.co, 'comanche')?.status === 'pending_review') || (out.posted && v?.voided),
      out.posted ? `K FIXED: jv=${out.posted.jv_no} voided=${v?.voided}` : out.refusal.slice(0, 160))
    if (!out.posted) await closeDialog()

    // ── A — auto-post ───────────────────────────────────────────────────────────────────
    since = new Date().toISOString()
    await autoPost('comanche', true)
    r = await sweep()
    await sleep(5000)
    const coYd = dayOf(pyJson('state'), YESTERDAY, 'comanche')
    check('A-02', 'auto-post on, a day with new rows: the sweep leaves it for a person, nothing posted',
      coYd?.status === 'pending_review' && openOf(coYd?.payload) > 0 && (await postsSince(since)) === 0, `${coYd?.status} new=${openOf(coYd?.payload)}`)
    if (kFixed) {
      na('A-03', 'Comanche mapped, auto-post on → carmen_rejected', 'Carmen posted Comanche in P-04 (ask K fixed): that day is posted, and a repeat hook leaves a posted day alone')
    } else {
      const sinceA3 = new Date().toISOString()
      r = await hook('comanche', R.co) // Approve wrote R.co's keys into Comanche's table
      postsExpected++
      for (let i = 0; i < 8 && (await postsSince(sinceA3)) < 1; i++);
      const a3 = await until(rs => {
        const d = dayOf(rs, R.co, 'comanche')
        return d && d.status !== 'received' && (d.reason_code === 'carmen_rejected' || d.status === 'posted') ? d : null
      })
      const a3v = a3?.status === 'posted' && a3.jv_no ? readAndVoid(a3.jv_no) : null
      check('A-03', 'Comanche mapped, auto-post on: a repeat hook re-reads it and sends it; Carmen refuses (K): carmen_rejected, no JV',
        a3?.reason_code === 'carmen_rejected' || (a3?.status === 'posted' && a3v?.voided), `${a3?.status}/${a3?.reason_code} ${a3?.error_message?.slice(0, 100) || ''}`)
    }
    await autoPost('comanche', false)

    py('ht-stage', R.ht2)
    await autoPost('hoteltime', true)
    r = await hook('hoteltime', R.ht2)
    postsExpected++
    const a1 = await until(rs => {
      const d = dayOf(rs, R.ht2, 'hoteltime')
      return d && (d.status === 'posted' || d.reason_code === 'carmen_rejected') ? d : null
    })
    const a1v = a1?.jv_no ? readAndVoid(a1.jv_no) : null
    check('A-01', `HotelTime ${R.ht2} mapped, auto-post on: a repeat hook re-reads it, nothing to map, it posts by itself; JV voided`,
      a1?.status === 'posted' && a1v?.voided && a1v?.jv?.dr === a1v?.jv?.cr, `${a1?.status}/${a1?.reason_code} jv=${a1?.jv_no} voided=${a1v?.voided}`)
    await autoPost('hoteltime', false)

    // ── E — hygiene ─────────────────────────────────────────────────────────────────────
    check('E-01', 'no page error in the browser', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
    const posts = await postsSince(t0)
    check('E-02', `Carmen's engine was asked to post exactly as often as this run meant to (${postsExpected})`, posts === postsExpected, `posts=${posts}`)
    const live = pyJson('jvs', R.co, R.ht1, R.ht2, R.cb).filter(j => !liveBefore.includes(j))
    check('E-03', 'no JV of this run is left live in Carmen', live.length === 0 && jvs.length === 0,
      `new live=${live.join(',')} unvoided=${jvs.join(',')} (live before, not ours: ${liveBefore.join(',')})`)
  } finally {
    await browser.close()
  }
}

async function teardown() {
  const t = []
  if (jvs.length) t.push(['T-01', `void the JVs left live (${jvs.join(',')})`, py('void', ...jvs).code === 0])
  if (snapped) for (const x of Object.values(PMS)) t.push(['T-02', `${x.setting} put back row for row`, py('restore', x.setting).code === 0])
  const un = py('unseed')
  let rows = []
  try {
    rows = JSON.parse(un.out.trim().split('\n').pop())
  } catch {
    /* no JSON: the helper failed */
  }
  const sum = k => rows.filter(x => x.status === k).map(x => `${x.pms} ${x.id}`).join(', ') || '-'
  t.push(['T-03', `reserved-date Data Bank rows deleted (${sum(200)}); kept for QA: ${sum('kept')}; Carmen refuses to delete: ${sum('stuck')}`,
    rows.length > 0 && rows.every(x => [200, 'kept', 'stuck'].includes(x.status))])
  t.push(['T-04', 'the test tenant\'s days forgotten', py('reset').code === 0])
  setSwitch({ mode: 'real' })
  for (const pms of Object.keys(PMS)) await autoPost(pms, false).catch(() => {})
  for (const [id, name, ok] of t) check(id, name, ok)
}

try {
  await run()
} catch (e) {
  check('RUN', e instanceof Stop ? `stopped: ${e.message}` : 'crashed', false, e.stack?.split('\n').slice(0, 3).join(' | '))
} finally {
  await teardown()
  const failed = results.filter(r => !r.ok)
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; failed: ${failed.map(f => f.id).join(', ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}
