// Decision-log #52 — Carmen's post checks the mapping, for every PMS: the full-system E2E.
// A PMS our reader cannot key (HotelTime: `Revenue` rows, `HT_Code` columns) parks with no
// preview or goes to Carmen, whose answer decides; a PartnerApi PMS's days are opened by the
// sweep. Data half: pms_post_checks_e2e.py. The cases: the test plan of 2026-11-06.
//
//   node scripts/qa/pms_post_checks_ui.mjs
//
// S setup · O opening PartnerApi days (first: the BU's interface list is cached once a day) ·
// N a day with no preview, in the browser · A auto-post · R a repeat hook · L language and phone ·
// E hygiene · T teardown (always).
//
// Needs the stack of pms_third_parties_ui.mjs, with the backend started by
// scripts/qa/pms_backend_stub.py (interface list switchable from .playwright-mcp/pms-pc/interfaces.json).
// **Carmen dev writes:** HotelTime's mapping table (N-07 stages one day's accounts; teardown puts the
// snapshot back). Every post here is refused by Carmen (-500, ErrorList, "No Data Found"): no JV.

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
const dayOf = (rows, bu, date) =>
  rows.find(r => r.bu === bu && r.event_id.toLowerCase() === `pms/hoteltime/daily/${date}`)
const daysOf = (rows, bu, date) =>
  rows.filter(r => r.bu === bu && r.event_id.toLowerCase() === `pms/hoteltime/daily/${date}`)

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
const hook = (key, date) =>
  http('POST', `${API}/api/v1/pms/events`, {
    headers: { Authorization: `Bearer ${key}` },
    body: { InterfaceType: 'PMS', InterfaceName: 'HotelTime', DocType: 'Daily', DocDate: date },
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
const queueRow = date => page.getByRole('row').filter({ hasText: dmy(date) }).filter({ hasText: 'HotelTime · Daily' })

async function openDay(date) {
  await chip('Review')
  await queueRow(date).getByRole('button', { name: 'Review' }).click()
  const dialog = page.getByRole('dialog').first()
  await dialog.waitFor({ timeout: 30000 })
  await dialog.getByText('HotelTime · Daily', { exact: false }).waitFor({ timeout: 60000 })
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
  for (const [bu, pms] of [[BU, 'hoteltime'], [BU, 'comanche'], [BU_B, 'hoteltime']]) {
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
  } finally {
    await browser.close()
  }

  // ── E — hygiene ─────────────────────────────────────────────────────────────────
  check('E-01', 'no uncaught error in the page', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  const log = fs.existsSync(BE_LOG) ? fs.readFileSync(BE_LOG, 'utf8') : ''
  const fives = log.split('\n').filter(l => /\/(pms|carmen\/pms)\//.test(l) && /" 5\d\d /.test(l))
  check('E-02', 'no 5xx from the PMS routes', log && fives.length === 0, fives.slice(0, 3).join(' | ') || (log ? '' : 'no log'))
  const llm1 = Number(py('llm').out.trim().split('\n').pop())
  check('E-03', 'no AI call for HotelTime days (nothing to preview)', llm1 === llm0, `calls ${llm0}→${llm1}`)
  const made = pyJson('jvs', ...HT_DAYS, YESTERDAY)
  check('E-04', 'no JV on any HotelTime day or yesterday', made.length === 0, `jvs=${made}`)
  if (made.length) py('void', ...made.map(String))
}

async function teardown() {
  const restored = py('ht-restore')
  check('T-01', "HotelTime's table is the snapshot", restored.code === 0, restored.out.trim().split('\n').pop())
  for (const [bu, pms] of [[BU, 'hoteltime'], [BU, 'comanche'], [BU_B, 'hoteltime']]) {
    if (pms === 'hoteltime') await carmenApi('PUT', '/settings', { uri: URI, bu, pms, auto_post: false })
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
