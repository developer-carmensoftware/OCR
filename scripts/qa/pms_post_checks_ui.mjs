// Decision-log #52 — Carmen's post checks the mapping, for every PMS: the full-system E2E.
// A PMS our reader cannot key (HotelTime: `Revenue` rows, `HT_Code` columns) parks with no
// preview or goes to Carmen, whose answer decides; a PartnerApi PMS's days are opened by the
// sweep. Data half: pms_post_checks_e2e.py. The cases: the test plan of 2026-11-06.
//
//   node scripts/qa/pms_post_checks_ui.mjs
//
// S setup · O opening PartnerApi days (first: the BU's interface list is cached once a day) ·
// N a day with no preview, in the browser · A auto-post · R a repeat hook · L language and phone ·
// CB Cloudbeds, a third layout, through Carmen's engine to a JV · E hygiene · T teardown (always).
//
// Needs the stack of pms_third_parties_ui.mjs, with the backend started by
// scripts/qa/pms_backend_stub.py (interface list switchable from .playwright-mcp/pms-pc/interfaces.json).
// **Start that backend afresh before every run:** the sweep caches each BU's interface list for
// the day, and a warm cache from an earlier run skips the outage O-06 stages (O-02/O-03/O-06 fail).
// PMS_E2E_CB=0 skips the CB group, for a rerun that should make no real JV.
// **Carmen dev writes:** HotelTime's mapping table (N-07 stages one day's accounts; teardown puts the
// snapshot back). Every HotelTime post is refused by Carmen (-500, ErrorList, "No Data Found").
// Cloudbeds (CB, the plan of 2026-11-06 afternoon): its empty table gets the keys Carmen's -500
// writes, each mapped to GEN/1021001, and the post that follows may make **one real JV, voided at
// once** (CB-06 stops the run if it cannot be). Teardown puts the table back empty.

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
const DAY_N = '2026-10-06' // the no-preview day reviewed in the browser
const DAY_A1 = '2026-10-05' // posted unattended
const DAY_A2 = '2026-10-04' // parked, then sent when auto-post is switched on
const HT_DAYS = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']
const CB = 'Cloudbeds.PMS'
const CB_DAY = '2026-10-26' // Data Bank Id 184: 86 Transaction rows, 78 keys
const CB_DAY2 = '2026-10-29' // Id 178: 87 keys, some new to CB_DAY
const CB_COLS = 'Description,MarketSegmentDesc'
let cbSnapped = false // teardown empties Cloudbeds' table only when this run found it empty
let cbBase = [] // the live JVs on the Cloudbeds days before the run (Carmen's own, e.g. 1588)
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
    await page.getByRole('button', { name: 'Show' }).click()
    await page.getByRole('option', { name, exact: true }).click()
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
  let p0 = await posts(t0)
  await sweep()
  await sweep()
  rows = pyJson('state')
  let pNow = await posts(t0)
  check('O-03', 'two more sweeps within the hour: no new day, Carmen not asked again',
    daysOf(rows, BU, YESTERDAY).length === 1 && pNow === p0 && dayOf(rows, BU, YESTERDAY)?.reason_code === 'day_not_ready',
    `posts ${p0}→${pNow}`)
  py('backdate', eid, '61', '0')
  p0 = pNow
  await sweep()
  await sleep(3000)
  const again = dayOf(pyJson('state'), BU, YESTERDAY)
  pNow = await posts(t0)
  check('O-04', 'an hour on: Carmen is asked again, still day_not_ready, still no try spent',
    again?.reason_code === 'day_not_ready' && again?.attempts === 0 && pNow === p0 + 1, `posts ${p0}→${pNow} attempts=${again?.attempts}`)
  py('backdate', eid, '61', '25')
  await sweep()
  const gone = await until(rs => {
    const d = dayOf(rs, BU, YESTERDAY)
    return d?.status === 'failed' ? d : null
  }, 30000)
  check('O-05', 'a day on, still no data: failed as day_not_found', gone?.reason_code === 'day_not_found', `${gone?.status}/${gone?.reason_code}`)

  // ── N — a day our reader cannot key, auto-post off ──────────────────────────────
  r = await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'hoteltime', auto_post: false })
  r = await hook(keys[`${BU}/hoteltime`], DAY_N)
  const dN = await until(rs => {
    const d = dayOf(rs, BU, DAY_N)
    return d?.status === 'pending_review' ? d : null
  })
  const pN = dN?.payload
  check('N-01', `hook → HotelTime ${DAY_N} parks with no preview, nothing posted`,
    r.status === 202 && pN?.preview === false && pN?.rows?.length === 0 && pN?.databank_id === 171 &&
      JSON.stringify(pN?.key_columns) === '["HT_Code","HT_Description","Department"]' &&
      (pN?.flags || []).length === 0 && !dN?.reason_code,
    `HTTP ${r.status} preview=${pN?.preview} rows=${pN?.rows?.length} id=${pN?.databank_id} cols=${pN?.key_columns} reason=${dN?.reason_code}`)

  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    if (!localStorage.getItem('lang')) localStorage.setItem('lang', 'en')
  })
  try {
    await signIn(BU)
    await chip('Review')
    const rowN = (await queueRow(DAY_N).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('N-02', 'the Review tab lists the day, "Ready to post"', /Ready to post/i.test(rowN), rowN.slice(0, 140))
    await shot('N-02-queue')

    let dialog = await openDay(DAY_N)
    const body = (await dialog.innerText()).replace(/\s+/g, ' ')
    check('N-03', "the dialog says the rows can't be shown and Carmen checks; no table, no AI, no 'Adds the new rows'; Approve open",
      /rows can't be shown here/.test(body) && (await dialog.getByRole('table').count()) === 0 &&
        !/Adds the new rows/.test(body) && (await dialog.getByText('AI', { exact: true }).count()) === 0 &&
        (await approveIn(dialog).isEnabled()),
      body.slice(0, 160))
    await shot('N-03-dialog')

    let p1 = await posts(t0)
    await approveIn(dialog).click()
    let said = await alertIn(dialog)
    rows = pyJson('state')
    let p1Now = await posts(t0)
    check('N-04', 'Approve → Carmen: mapping incomplete; the day stays parked, saying so; no JV',
      /Mapping is incomplete/.test(said) && dayOf(rows, BU, DAY_N)?.status === 'pending_review' &&
        dayOf(rows, BU, DAY_N)?.reason_code === 'pms_mapping_incomplete' && p1Now === p1 + 1,
      `"${said}" reason=${dayOf(rows, BU, DAY_N)?.reason_code} posts ${p1}→${p1Now}`)
    await shot('N-04-refused')

    await page.keyboard.press('Escape')
    dialog = await openDay(DAY_N)
    const banner = (await dialog.locator('.mapping-alert').first().innerText().catch(() => '')).trim()
    await chip('Review')
    const rowN2 = (await queueRow(DAY_N).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('N-05', "reopened: the banner and the queue row say what Carmen found",
      /has no account in its mapping/.test(banner) && /has no account in its mapping/.test(rowN2), `banner="${banner.slice(0, 90)}" row="${rowN2.slice(0, 90)}"`)

    dialog = await openDay(DAY_N)
    p1 = await posts(t0)
    await page.keyboard.press('Control+Enter')
    said = await alertIn(dialog)
    p1Now = await posts(t0)
    check('N-06', 'Ctrl+Enter approves a no-preview day too', /Mapping is incomplete/.test(said) && p1Now === p1 + 1,
      `"${said}" posts ${p1}→${p1Now}`)

    const staged = pyJson('ht-stage', DAY_N)
    await page.keyboard.press('Escape')
    dialog = await openDay(DAY_N)
    await approveIn(dialog).click()
    said = await alertIn(dialog)
    rows = pyJson('state')
    const madeN = pyJson('jvs', DAY_N)
    check('N-07', "mapped in Carmen, Approve again: Carmen passes the mapping and answers its next fault; the reason follows it; no JV",
      !/Mapping is incomplete/.test(said) && /Carmen didn't post the day/.test(said) &&
        dayOf(rows, BU, DAY_N)?.reason_code === 'carmen_rejected' && madeN.length === 0,
      `staged=${staged.staged} "${said.slice(0, 120)}" reason=${dayOf(rows, BU, DAY_N)?.reason_code} jvs=${madeN}`)
    if (madeN.length) py('void', ...madeN.map(String))
    await shot('N-07-next-fault')
    const restored = pyJson('ht-restore')
    check('N-07', "HotelTime's table put back as it was", restored.restored === true)

    await page.keyboard.press('Escape')
    dialog = await openDay(DAY_N)
    await dialog.getByRole('button', { name: /^reject$/i }).click()
    await page.getByText('Reject this day?').waitFor({ timeout: 15000 })
    await page.getByPlaceholder('e.g. night audit rerun').fill('E2E: no-preview reject')
    await page.getByRole('button', { name: /^reject day$/i }).click()
    const rej = await until(rs => (dayOf(rs, BU, DAY_N)?.status === 'rejected' ? dayOf(rs, BU, DAY_N) : null), 30000)
    r = await hook(keys[`${BU}/hoteltime`], DAY_N)
    const back = await until(rs => {
      const d = dayOf(rs, BU, DAY_N)
      return d?.status === 'pending_review' && d?.payload?.preview === false && !d?.reason_code ? d : null
    })
    check('N-08', 'Reject → rejected, payload cleared; a repeat hook brings it back with no preview',
      rej?.payload == null && r.status === 200 && !!back, `rejected=${rej?.status} back=${back?.status}`)

    // ── A — auto-post ─────────────────────────────────────────────────────────────
    r = await hook(keys[`${BU}/hoteltime`], DAY_A2)
    const parkedA2 = await until(rs => (dayOf(rs, BU, DAY_A2)?.status === 'pending_review' ? dayOf(rs, BU, DAY_A2) : null))
    await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'hoteltime', auto_post: true })
    r = await hook(keys[`${BU}/hoteltime`], DAY_A1)
    const dA1 = await until(rs => {
      const d = dayOf(rs, BU, DAY_A1)
      return d?.status === 'pending_review' && d?.reason_code ? d : null
    })
    check('A-01', `auto-post on: HotelTime ${DAY_A1} goes to Carmen, which refuses; parked pms_mapping_incomplete`,
      dA1?.reason_code === 'pms_mapping_incomplete' && dA1?.payload?.preview === false, `${dA1?.status}/${dA1?.reason_code}`)
    sw = await sweep()
    const dA2 = await until(rs => {
      const d = dayOf(rs, BU, DAY_A2)
      return d?.reason_code === 'pms_mapping_incomplete' ? d : null
    })
    check('A-02', `switching auto-post on sends the parked ${DAY_A2} to Carmen on the next sweep`,
      !!parkedA2 && !!dA2 && (sw.json?.requeued ?? 0) >= 1, `requeued=${sw.json?.requeued} ${dA2?.reason_code}`)
    const p2 = await posts(t0)
    await sweep()
    await sweep()
    rows = pyJson('state')
    const p2Now = await posts(t0)
    check('A-03', 'refused days are not sent again sweep after sweep (no loop)',
      p2Now === p2 && dayOf(rows, BU, DAY_A1)?.reason_code === 'pms_mapping_incomplete' &&
        dayOf(rows, BU, DAY_A2)?.reason_code === 'pms_mapping_incomplete',
      `posts ${p2}→${p2Now}`)

    // ── R — a repeat hook re-reads a refused day ────────────────────────────────────
    await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'hoteltime', auto_post: false })
    r = await hook(keys[`${BU}/hoteltime`], DAY_A1)
    const reread = await until(rs => {
      const d = dayOf(rs, BU, DAY_A1)
      return d?.status === 'pending_review' && !d?.reason_code ? d : null
    })
    check('R-01', 'a repeat hook for a refused day re-reads it: reason cleared, "Ready to post" again',
      r.status === 200 && reread?.payload?.preview === false, `${reread?.status}/${reread?.reason_code}`)

    // O-05, seen: the failed opened day under Not posted, with its reason.
    await chip('Not posted')
    const rowGone = (await queueRow(YESTERDAY).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('O-05', 'the failed opened day shows under Not posted, "Data Bank does not have this day"',
      /Data Bank does not have this day/.test(rowGone), rowGone.slice(0, 140))
    await shot('O-05-not-posted')

    // ── L — Thai, and a phone ───────────────────────────────────────────────────────
    // By the dialog's own address: the queue's button is worded in the reader's language.
    const idA1 = dayOf(pyJson('state'), BU, DAY_A1)?.id
    const direct = async () => {
      await page.goto(`${APP}/#/CreditCardOCR/review?pms=${idA1}`)
      await page.reload()
      const d = page.getByRole('dialog').first()
      await d.getByText('HotelTime · Daily', { exact: false }).waitFor({ timeout: 60000 })
      return d
    }
    await page.evaluate(() => localStorage.setItem('lang', 'th'))
    dialog = await direct().catch(() => null)
    const th = dialog ? (await dialog.innerText()).replace(/\s+/g, ' ') : ''
    check('L-01', 'in Thai the no-preview note reads Thai', /แสดงรายการของ PMS นี้ที่นี่ไม่ได้/.test(th), th.slice(0, 120))
    await shot('L-01-thai')
    await page.evaluate(() => localStorage.setItem('lang', 'en'))
    await page.setViewportSize({ width: 390, height: 844 })
    dialog = await direct()
    const wide = await page.evaluate(() => document.documentElement.scrollWidth)
    check('L-02', 'at 390 px the dialog fits: no sideways scroll, the note readable',
      wide <= 390 && /rows can't be shown here/.test(await dialog.innerText()), `scrollWidth=${wide}`)
    await shot('L-02-phone')

    // ── CB — Cloudbeds: a third layout, through Carmen's engine to a JV ──────────────
    // Its day carries the key columns in two lists (Transaction, Statistic), so there is no
    // preview: Carmen's post is the whole check. Its -500 writes the missing keys into the
    // table; mapping them (as a person would in Carmen's screen) lets the next post through.
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
      await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'cloudbeds', auto_post: false })
      const llmCb = Number(py('llm').out.trim().split('\n').pop())
      r = await hook(keys[`${BU}/cloudbeds`], CB_DAY, 'Cloudbeds')
      const dCb = await until(rs => {
        const d = dayOf(rs, BU, CB_DAY, 'cloudbeds')
        return d?.status === 'pending_review' ? d : null
      })
      const pCb = dCb?.payload
      const llmCbNow = Number(py('llm').out.trim().split('\n').pop())
      // The key is whatever Carmen's table declares: Description, MarketSegmentDesc and, since
      // Carmen's first -500 on dev (2026-11-06), Channel, which no list of the day carries.
      check('CB-01', `hook → Cloudbeds ${CB_DAY} parks with no preview (no single list carries Carmen's key), no AI`,
        r.status === 202 && pCb?.preview === false && pCb?.rows?.length === 0 && pCb?.databank_id === 184 &&
          pCb?.setting_code === CB && JSON.stringify(pCb?.key_columns) === JSON.stringify(cb0.key_columns) &&
          (pCb?.flags || []).length === 0 && !dCb?.reason_code && llmCbNow === llmCb,
        `HTTP ${r.status} preview=${pCb?.preview} id=${pCb?.databank_id} code=${pCb?.setting_code} cols=${pCb?.key_columns} reason=${dCb?.reason_code} ai ${llmCb}→${llmCbNow}`)

      await chip('Review')
      const rowCb = (await queueRow(CB_DAY, 'Cloudbeds').innerText().catch(() => '')).replace(/\s+/g, ' ')
      dialog = await openDay(CB_DAY, 'Cloudbeds')
      const bodyCb = (await dialog.innerText()).replace(/\s+/g, ' ')
      check('CB-02', "the queue says \"Ready to post\"; the dialog says the rows can't be shown and Carmen checks",
        /Ready to post/i.test(rowCb) && /rows can't be shown here/.test(bodyCb) &&
          (await dialog.getByRole('table').count()) === 0 && (await approveIn(dialog).isEnabled()),
        `row="${rowCb.slice(0, 110)}"`)
      await shot('CB-02-dialog')

      await approveIn(dialog).click()
      said = await alertIn(dialog)
      rows = pyJson('state')
      const refusedCb = dayOf(rows, BU, CB_DAY, 'cloudbeds')
      const jvAfterRefusal = pyJson('jvs', CB_DAY).filter(s => !cbBase.includes(s))
      const minus500 = check('CB-03', 'Approve → Carmen: mapping incomplete (its table is empty); parked pms_mapping_incomplete; no JV',
        /Mapping is incomplete/.test(said) && refusedCb?.status === 'pending_review' &&
          refusedCb?.reason_code === 'pms_mapping_incomplete' && jvAfterRefusal.length === 0,
        `"${said.slice(0, 120)}" reason=${refusedCb?.reason_code} new JVs=${jvAfterRefusal}`)
      await shot('CB-03-refused')

      if (minus500) {
        const cb1 = pyJson('table', CB, CB_COLS) // keyed on the columns the day has (not Channel)
        const tx = pyJson('day-keys', 'Cloudbeds', CB_DAY, 'Transaction', CB_COLS)
        const st = pyJson('day-keys', 'Cloudbeds', CB_DAY, 'Statistic', CB_COLS)
        const sameSet = (a, b) => a.length === b.length && a.every(k => b.includes(k))
        const both = [...new Set([...tx.keys, ...st.keys])]
        const which = sameSet(cb1.keys, tx.keys) ? 'Transaction' : sameSet(cb1.keys, both) ? 'Transaction+Statistic' : 'other'
        check('CB-04', "Carmen's -500 wrote the day's missing keys into its table, none with an account",
          cb1.rows > 0 && cb1.blank === cb1.rows && which !== 'other',
          `rows=${cb1.rows} blank=${cb1.blank} keys = ${which} (Transaction ${tx.keys.length}, Statistic ${st.keys.length})` +
            (which === 'other' ? ` only-in-table=${cb1.keys.filter(k => !both.includes(k)).slice(0, 3)}` : ''))

        const filled = pyJson('fill-blank', CB, 'GEN', '1021001')
        await page.keyboard.press('Escape')
        dialog = await openDay(CB_DAY, 'Cloudbeds')
        await approveIn(dialog).click()
        // Carmen either posts (the day turns `posted`) or refuses (its words show in the dialog).
        let posted = null
        let refusal = ''
        for (let i = 0; i < 60 && !posted && !refusal; i++) {
          await sleep(2000)
          const d = dayOf(pyJson('state'), BU, CB_DAY, 'cloudbeds')
          if (d?.status === 'posted') posted = d
          else if (await dialog.getByRole('alert').isVisible().catch(() => false))
            refusal = (await dialog.getByRole('alert').innerText()).trim()
        }
        const newJvs = pyJson('jvs', CB_DAY).filter(s => !cbBase.includes(s))
        if (posted) {
          const jv = pyJson('jv', String(posted.jv_no))
          await chip('Posted')
          const rowP = queueRow(CB_DAY, 'Cloudbeds')
          const textP = (await rowP.innerText().catch(() => '')).replace(/\s+/g, ' ')
          const href = await rowP.getByRole('link', { name: /Open JV/ }).getAttribute('href').catch(() => null)
          check('CB-05', 'mapped in Carmen, Approve again: Carmen posts the day; the queue shows its JV and Open JV links to it',
            newJvs.length === 1 && String(newJvs[0]) === String(posted.jv_no) && jv.date === CB_DAY && jv.lines > 0 &&
              jv.dr === jv.cr && textP.includes(String(posted.jv_no)) && !!href && href.includes(`/glJv/${posted.jv_no}/show`),
            `filled=${filled.filled} ${JSON.stringify(jv)} href=${href}`)
          await shot('CB-05-posted')
          const v = py('void', String(posted.jv_no))
          const left = pyJson('jvs', CB_DAY).filter(s => !cbBase.includes(s))
          const voided = check('CB-06', `JV ${posted.jv_no} voided at once; ${CB_DAY}'s live JVs are back to before`,
            v.code === 0 && left.length === 0, `${v.out.trim().split('\n').pop()} left=${left}`)
          if (!voided) throw new Stop(`JV ${posted.jv_no} could not be voided: void it in Carmen by hand`)
          r = await hook(keys[`${BU}/cloudbeds`], CB_DAY, 'Cloudbeds')
          await sleep(6000)
          const still = dayOf(pyJson('state'), BU, CB_DAY, 'cloudbeds')
          check('CB-07', 'a repeat hook for the posted day changes nothing',
            r.status === 200 && r.json?.duplicate === true && still?.status === 'posted', `HTTP ${r.status} status=${still?.status}`)
        } else {
          const dRef = dayOf(pyJson('state'), BU, CB_DAY, 'cloudbeds')
          check('CB-05', "mapped in Carmen, Approve again: Carmen passes the mapping; its next answer shows and becomes the reason",
            !!refusal && !/Mapping is incomplete/.test(refusal) && /Carmen didn't post the day/.test(refusal) &&
              dRef?.reason_code === 'carmen_rejected' && newJvs.length === 0,
            `filled=${filled.filled} "${refusal.slice(0, 160)}" reason=${dRef?.reason_code} new JVs=${newJvs}`)
          if (newJvs.length) py('void', ...newJvs.map(String))
          await shot('CB-05-refused')
        }

        // CB-08: a second day with keys of its own, unattended.
        const cbBefore = pyJson('table', CB, CB_COLS)
        const tx2 = pyJson('day-keys', 'Cloudbeds', CB_DAY2, 'Transaction', CB_COLS)
        const fresh = tx2.keys.filter(k => !cbBefore.keys.includes(k))
        await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'cloudbeds', auto_post: true })
        r = await hook(keys[`${BU}/cloudbeds`], CB_DAY2, 'Cloudbeds')
        const d2 = await until(rs => {
          const d = dayOf(rs, BU, CB_DAY2, 'cloudbeds')
          return d && (d.status === 'posted' || d.reason_code) ? d : null
        }, 120000)
        const made2 = pyJson('jvs', CB_DAY2).filter(s => !cbBase.includes(s))
        if (made2.length) py('void', ...made2.map(String)) // posted after all: undone at once
        const cbAfter = pyJson('table', CB, CB_COLS)
        const added = cbAfter.rows - cbBefore.rows
        check('CB-08', `auto-post on: ${CB_DAY2} goes to Carmen; only its ${fresh.length} new keys come back as blank rows; parked pms_mapping_incomplete; no JV`,
          r.status === 202 && d2?.reason_code === 'pms_mapping_incomplete' && made2.length === 0 &&
            added === fresh.length && cbAfter.blank === added,
          `${d2?.status}/${d2?.reason_code} rows ${cbBefore.rows}→${cbAfter.rows} added=${added} blank=${cbAfter.blank} JVs=${made2}`)
        await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'cloudbeds', auto_post: false })
      }
    }
  } finally {
    await browser.close()
  }

  // ── E — hygiene ─────────────────────────────────────────────────────────────────
  check('E-01', 'no uncaught error in the page', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  const log = fs.existsSync(BE_LOG) ? fs.readFileSync(BE_LOG, 'utf8') : ''
  const fives = log.split('\n').filter(l => /\/(pms|carmen\/pms)\//.test(l) && /" 5\d\d /.test(l))
  check('E-02', 'no 5xx from the PMS routes', log && fives.length === 0, fives.slice(0, 3).join(' | ') || (log ? '' : 'no log'))
  const llm1 = Number(py('llm').out.trim().split('\n').pop())
  check('E-03', 'no AI call for HotelTime or Cloudbeds days (nothing to preview)', llm1 === llm0, `calls ${llm0}→${llm1}`)
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
