// PMS processing from Carmen's interface list (decision-log #51) — the full-system E2E:
// Carmen's hook → our processing reads Carmen (interfaceThirdParties, the mapping table, the
// Data Bank) → the day parks → a person approves in the browser → the whole table goes back →
// Carmen's engine posts. Data half and Carmen read-backs: pms_third_parties_e2e.py.
//
//   node scripts/qa/pms_third_parties_ui.mjs
//
// P-01..03 preflight + the success path · S-01..04 setup · A-01..07 processing · B-01..10 the review ·
// C-01..04 re-read, auto-post, repeat · D-01..05 reject, resend, already posted ·
// F-01 the JV number in the queue · E-01..03 hygiene · T-01..03 teardown (always). The cases: the plan of 2026-11-03, in
// changelog/2026-11-03.md.
//
// Needs, as env (defaults in brackets):
//   APP_URL   the frontend, proxying /api to the BRANCH backend [http://localhost:3011]
//   API_URL   that backend, run on LOCAL Supabase [http://localhost:8011]
//   BE_LOG    its log file, for E-02 [%TEMP%/be8011.log]
//   PYTHON    [backend/venv/Scripts/python.exe]
//   PLAYWRIGHT_CORE / CHROME_EXE as in review_payload_ui.mjs
// Reads CARMEN_AUTHORIZATION and INTERNAL_JOB_TOKEN from backend/.env. **Stages carmencloud dev's
// real Comanche mapping table and posts 2 real Comanche JVs; teardown restores and voids** (the
// helper's docstring says why Comanche and not test.PMS).

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, '.playwright-mcp/pms-tp')
const APP = process.env.APP_URL || 'http://localhost:3011'
const API = process.env.API_URL || 'http://127.0.0.1:8011'
const BE_LOG = process.env.BE_LOG || path.join(os.tmpdir(), 'be8011.log')
const PY = process.env.PYTHON || path.join(ROOT, 'backend/venv/Scripts/python.exe')
const HELPER = path.join(ROOT, 'scripts/qa/pms_third_parties_e2e.py')
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
const BU = 'pms-e2e'
const BU_B = 'pms-e2e-b'
// Carmen's Comanche.PMS refuses A and B ("Line No. 30,31 has no DrCr value", ask K), still on
// 2026-11-13, though it posted other Comanche days that day (suite 3, JV 1632/1636/1640). B-08
// and C-02..C-04 take either answer: Carmen's refusal in its own words, or a posted day whose
// JV teardown voids. D is the day Carmen
// posted itself (JV 36): "already posted". The success path is P-03, on test.PMS.
const DAY_A = '2024-07-01' // approved in the browser; Carmen refuses (K) or posts
const DAY_B = '2025-10-20' // auto-posted; Carmen refuses (K) or posts
const DAY_D = '2024-09-01' // the second tenant's; Carmen answers "Already Posted"

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

const keyOf = (rows, bu, date) =>
  rows.find(r => r.bu === bu && r.event_id.toLowerCase() === `pms/comanche/daily/${date}`)

/** Poll the stored rows until `pred(rows)` returns a value, or fail after `ms`. */
async function until(pred, ms = 90000) {
  const end = Date.now() + ms
  let last
  while (Date.now() < end) {
    last = pyJson('state')
    const hit = pred(last)
    if (hit) return hit
    await sleep(2000)
  }
  return null
}

async function http(method, url, { headers = {}, body } = {}) {
  const send = () =>
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
  let res
  try {
    res = await send()
  } catch (e) {
    // undici can reuse a keep-alive socket uvicorn has just closed (its idle timeout is 5 s,
    // and the polling between calls is longer): one retry on a fresh connection. Every call
    // here is safe to repeat — a hook again is a duplicate, a settings write the same value.
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

const carmenApi = (method, p, body) =>
  http(method, `${API}/api/v1/carmen/pms${p}`, { headers: { Authorization: CARMEN }, body })

const hook = (key, name, date) =>
  http('POST', `${API}/api/v1/pms/events`, {
    headers: { Authorization: `Bearer ${key}` },
    body: { InterfaceType: 'PMS', InterfaceName: name, DocType: 'Daily', DocDate: date },
  })

const sweep = () =>
  http('POST', `${API}/api/v1/pms/process/run`, { headers: { Authorization: `Bearer ${JOB}` } })

async function activity() {
  const r = await http('GET', `${API}/api/v1/credit-card/activity?filter=all&limit=100`, {
    headers: { Authorization: `Bearer ${session}` },
  })
  return (r.json?.data || []).filter(x => x.source === 'pms')
}

const dmy = iso => iso.split('-').reverse().join('/')

async function shot(name) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

/** Sign in the way a Carmen user does: the menu's SSO link, in a fresh tab. */
async function signIn(bu) {
  if (page) await page.close()
  page = await context.newPage()
  page.on('pageerror', err => pageErrors.push(String(err)))
  const sso = new URLSearchParams({ token: CARMEN, bu, uri: URI })
  await page.goto(`${APP}/#/CreditCardOCR?${sso}`)
  // The heading, not a tab: a queue with no rows renders its empty state and no tabs.
  const heading = page.getByText('AI JV Automation').first()
  const consent = page.locator('.uc-confirm-btn')
  await Promise.race([heading.waitFor({ timeout: 60000 }), consent.waitFor({ timeout: 60000 })])
  await page.waitForTimeout(1500) // the consent check answers after the shell paints
  if (await consent.isVisible()) {
    await page.locator('input[type="checkbox"]').first().check() // the consent modal's only one
    await consent.click()
  }
  await heading.waitFor({ timeout: 60000 })
  session = await page.evaluate(() => sessionStorage.getItem('ocr_access_token'))
  if (!session) throw new Stop('SSO exchange left no session token')
}

/** The queue's two tabs are Review and All; Posted / Not posted are the `Filter` menu's Status
 *  values (the filter bar of #359), picked as jv_filters_ui.mjs's `pill` does. */
async function chip(name) {
  await page.goto(`${APP}/#/CreditCardOCR`)
  // Going to the hash the page is already on refetches nothing: reload, so the rows are
  // what the server holds now (the session survives in sessionStorage).
  await page.reload()
  const tab = page.getByRole('tab', { name: new RegExp(`^${name === 'Review' ? 'Review' : 'All'}`) })
  await tab.waitFor({ timeout: 30000 })
  await tab.click()
  if (name !== 'Review' && name !== 'All') {
    const menu = page.locator('.rq-menu')
    await page.getByRole('button', { name: /^Filter$/ }).click()
    await menu.getByRole('menuitem', { name: /^Status/ }).click()
    await menu.locator('[role^="menuitem"]').filter({ hasText: new RegExp(`^${name}(\\s|$)`) }).click()
    await page.mouse.click(4, 4) // close the menu as a reader does
  }
  await page.waitForTimeout(1500)
}

const queueRow = date => page.getByRole('row').filter({ hasText: dmy(date) }).filter({ hasText: 'Comanche · Daily' })

async function openDay(date) {
  await chip('Review')
  await queueRow(date).getByRole('button', { name: 'Review' }).click()
  const dialog = page.getByRole('dialog').first()
  await dialog.waitFor({ timeout: 30000 })
  await dialog.getByText(/\d+ rows/).waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500) // Carmen's departments and accounts load after the day
  return dialog
}

/** Pick `code` in a CustomSearchSelect: open it, type, press the option that starts with it. */
async function pick(input, code) {
  await input.click()
  await input.fill(code)
  const option = page.locator('.css-select-panel [role="button"]:not([aria-disabled="true"])')
  await option.first().waitFor({ timeout: 10000 })
  const n = await option.count()
  for (let i = 0; i < n; i++) {
    const text = (await option.nth(i).innerText()).trim()
    if (text.startsWith(code)) {
      await option.nth(i).click()
      return true
    }
  }
  await input.press('Escape')
  return false
}

/** Any other account the picker offers for this row. */
async function pickOther(input, current) {
  await input.click()
  const option = page.locator('.css-select-panel [role="button"]:not([aria-disabled="true"])')
  await option.first().waitFor({ timeout: 10000 })
  const n = await option.count()
  for (let i = 0; i < n; i++) {
    const text = (await option.nth(i).innerText()).trim()
    const code = text.split(/\s/)[0]
    if (code && code !== current) {
      await option.nth(i).click()
      return code
    }
  }
  await input.press('Escape')
  return null
}

async function toast(re, ms = 60000) {
  const t = page.locator('[data-sonner-toast]').filter({ hasText: re })
  try {
    await t.first().waitFor({ timeout: ms })
    return (await t.first().innerText()).trim()
  } catch {
    const any = await page.locator('[data-sonner-toast]').allInnerTexts()
    return { missed: any.join(' | ') }
  }
}

async function run() {
  // ── P — preflight ─────────────────────────────────────────────────────────────
  const pre = py('preflight')
  process.stdout.write(pre.out)
  for (const line of pre.out.trim().split('\n').filter(l => /^(PASS|FAIL) /.test(l)))
    results.push({ id: line.split(' ')[1], name: line, ok: line.startsWith('PASS') })
  if (pre.code !== 0) throw new Stop('preflight failed (Comanche not listed, a live JV on A/B, or none on D)')

  // ── P-03 — the success path: our post, no counter, on a day Carmen posts ──────
  const probe = py('engine-probe')
  process.stdout.write(probe.out)
  for (const line of probe.out.trim().split('\n').filter(l => /^(PASS|FAIL) /.test(l)))
    results.push({ id: line.split(' ')[1], name: line, ok: line.startsWith('PASS') })

  // ── S — setup ─────────────────────────────────────────────────────────────────
  const setup = py('setup')
  process.stdout.write(setup.out)
  for (const line of setup.out.trim().split('\n').filter(l => /^(PASS|FAIL) /.test(l)))
    results.push({ id: line.split(' ')[1], name: line, ok: line.startsWith('PASS') })
  if (setup.code !== 0) throw new Stop(`setup failed: ${setup.err.slice(-400)}`)
  const st = JSON.parse(fs.readFileSync(path.join(OUT, 'state.json'), 'utf8'))
  const trimmed = st.trimmed // [{key, values:{Code,Description}, snapshot:{dept,acc}}]
  const trimmedKeys = new Set(trimmed.map(t => t.key))

  const keys = {}
  for (const [bu, pms] of [
    [BU, 'comanche'],
    [BU, 'opera'],
    [BU_B, 'comanche'],
  ]) {
    const r = await carmenApi('POST', '/keys', { uri: URI, bu, pms })
    keys[`${bu}/${pms}`] = r.json?.api_key
    check('S-03', `key for ${bu} × ${pms}`,
      r.status === 201 && r.json?.api_key?.startsWith('cpk_') && r.json?.has_credential,
      `HTTP ${r.status}`)
    await sleep(3500) // Carmen's settings API: 20 calls a minute per IP
  }
  for (const bu of [BU, BU_B]) {
    const r = await carmenApi('PUT', '/settings', { uri: URI, bu, pms: 'comanche', auto_post: false })
    check('S-04', `auto-post off for ${bu} × comanche`, r.status === 200 && r.json?.auto_post === false, `HTTP ${r.status}`)
    await sleep(3500)
  }

  // ── A — processing ────────────────────────────────────────────────────────────
  const parked = (bu, date) => rows => {
    const d = keyOf(rows, bu, date)
    return d && d.status === 'pending_review' ? d : null
  }
  const newKeys = p => [...(p?.missing || []), ...(p?.ai || [])]

  let r = await hook(keys[`${BU}/comanche`], 'Comanche', DAY_A)
  const dayA = await until(parked(BU, DAY_A))
  const pa = dayA?.payload
  check('A-01', `hook → Comanche ${DAY_A} parks with the derived setting`, r.status === 202 && pa &&
    pa.setting_code === 'Comanche.PMS' && pa.post_type === 'REVENUE' &&
    JSON.stringify(pa.key_columns) === '["Code","Description"]' && pa.rows?.length === st.days[DAY_A].rows &&
    pa.databank_id === st.days[DAY_A].id && !('counter' in pa),
    `HTTP ${r.status} status=${dayA?.status} code=${pa?.setting_code} cols=${pa?.key_columns} rows=${pa?.rows?.length} databank=${pa?.databank_id} counter=${pa && 'counter' in pa}`)
  const newA = newKeys(pa)
  check('A-01', 'the 3 trimmed keys, and only they, are new',
    newA.length === 3 && newA.every(k => trimmedKeys.has(k)), `new=${newA.length}`)
  const guessedA = Object.keys(pa?.guessed || {})
  check('A-01', 'flags name the AI\'s picks or the missing rows',
    (pa?.flags || []).some(f => f === 'mapping_guessed' || f === 'mapping_missing'),
    `flags=${pa?.flags} ai=${guessedA.length}`)
  if (!guessedA.length) {
    const log = fs.existsSync(BE_LOG) ? fs.readFileSync(BE_LOG, 'utf8') : ''
    const why = log.split('\n').filter(l => /openrouter|402|LLM|suggest/i.test(l)).slice(-5).join(' | ')
    throw new Stop(`the AI made no pick for any new row (stop rule): ${why || 'no log line'}`)
  }

  r = await hook(keys[`${BU}/comanche`], 'Comanche', DAY_B)
  const dayB = await until(parked(BU, DAY_B))
  const pb = dayB?.payload
  check('A-02', `hook → Comanche ${DAY_B} parks the same way`, r.status === 202 && pb?.databank_id === st.days[DAY_B].id &&
    pb?.rows?.length === st.days[DAY_B].rows && newKeys(pb).length === 3 && !('counter' in (pb || {})),
    `databank=${pb?.databank_id} new=${newKeys(pb).length}`)

  r = await hook(keys[`${BU}/comanche`], 'Comanche', DAY_A)
  await sleep(1000)
  const again = await until(parked(BU, DAY_A))
  check('A-03', 'a repeat hook re-reads an unposted day', r.status === 200 && r.json?.duplicate === true &&
    newKeys(again?.payload).length === 3, `HTTP ${r.status} duplicate=${r.json?.duplicate}`)

  r = await hook(keys[`${BU}/comanche`], 'Comanche', '2026-10-08')
  // Decision-log #54: the day's rows are Carmen's preview of the post. A Data Bank row its
  // engine reads nothing from answers -400 "No Data Found", which waits hourly as day_not_ready,
  // as the post's own -400 does. Nothing is guessed and no AI is asked (E-03).
  const junk = await until(rows => {
    const d = keyOf(rows, BU, '2026-10-08')
    return d?.reason_code ? d : null
  })
  check('A-04', "a Data Bank day Carmen's engine reads nothing from waits as day_not_ready (its preview: No Data Found)",
    junk?.status === 'received' && junk?.reason_code === 'day_not_ready' && /No Data Found/i.test(junk?.error_message || ''),
    `${junk?.status}/${junk?.reason_code} "${(junk?.error_message || '').slice(0, 80)}"`)

  r = await hook(keys[`${BU}/comanche`], 'Comanche', '2023-01-01')
  const absent = await until(rows => {
    const d = keyOf(rows, BU, '2023-01-01')
    return d?.reason_code ? d : null
  })
  check('A-05', 'a day the Data Bank lacks waits as day_not_found',
    absent?.status === 'received' && absent?.reason_code === 'day_not_found', `${absent?.status}/${absent?.reason_code}`)

  r = await hook(keys[`${BU}/opera`], 'Opera', DAY_A)
  const opera = await until(rows => {
    const d = rows.find(x => x.event_id.toLowerCase() === `pms/opera/daily/${DAY_A}`)
    return d?.reason_code ? d : null
  })
  check('A-06', 'a PMS Carmen does not list waits as pms_setting_missing',
    opera?.status === 'received' && opera?.reason_code === 'pms_setting_missing', `${opera?.status}/${opera?.reason_code}`)
  py('last-attempt', opera.id)
  const sw = await sweep()
  const operaDone = await until(rows => rows.find(x => x.id === opera.id && x.status === 'failed'), 30000)
  check('A-06', '…and fails on its last attempt', sw.status === 200 && operaDone?.reason_code === 'pms_setting_missing',
    `sweep HTTP ${sw.status} → ${operaDone?.status}`)

  r = await hook(keys[`${BU}/comanche`], 'Opera', DAY_A)
  check('A-07', 'a key for one PMS refuses another\'s day', r.status === 403 && /comanche/.test(r.text), `HTTP ${r.status} ${r.text.slice(0, 80)}`)

  // ── B — the review, in the browser ────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('lang', 'en'))
  try {
    await signIn(BU)
    await chip('Review')
    const rowA = queueRow(DAY_A)
    const rowB = queueRow(DAY_B)
    const textA = (await rowA.innerText().catch(() => '')).replace(/\s+/g, ' ')
    const textB = (await rowB.innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('B-01', 'the Review chip lists both days, with the reason naming the codes',
      /PMS/.test(textA) && /PMS/.test(textB) && /(AI suggested mapping|Mapping missing)/.test(textA) &&
        trimmed.some(t => textA.includes(t.values.Code)),
      `A="${textA.slice(0, 120)}" B="${textB.slice(0, 60)}"`)
    await shot('B-01-review-chip')

    await chip('Not posted')
    const npText = (await page.getByRole('table').innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('B-02', 'Not posted shows the opera day with its reason; the day with no data is not failed (it waits, #54)',
      /Carmen has no PMS posting setting for this interface/.test(npText) &&
        !/Could not read this day from the Data Bank/.test(npText),
      npText.slice(0, 200))
    await shot('B-02-not-posted')

    // One AI pick is blanked in the day as the browser receives it, so the blocked state
    // (B-05) and a hand pick (B-06) happen whatever the AI chose. That row's account is the
    // one the staged table had for it before the cut.
    const handKey = guessedA[0]
    const hand = trimmed.find(t => t.key === handKey)
    await page.route(`**/api/v1/pms/days/${dayA.id}`, async route => {
      const res = await route.fetch()
      const body = await res.json()
      for (const c of body.new_codes || []) if (c.key === handKey) Object.assign(c, { dept: null, acc: null })
      await route.fulfill({ response: res, json: body })
    })
    const dialog = await openDay(DAY_A)
    await page.unroute(`**/api/v1/pms/days/${dayA.id}`)
    const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ')
    const accInputs = dialog.locator('input[aria-label^="Account for "]')
    const bodyRows = dialog.locator('table tbody tr')
    const headers = (await dialog.locator('table thead').innerText()).replace(/\s+/g, ' ')
    const nKeys = st.days[DAY_A].keys // the table shows one row per key
    check('B-03', `one Accounts table: 3 new rows with pickers, ${nKeys - 3} of Carmen's read-only, no amounts`,
      new RegExp(`${nKeys} rows`, 'i').test(dialogText) && // the head is CSS-uppercased
 (await accInputs.count()) === 3 && (await bodyRows.count()) === nKeys &&
        /DeptCode/i.test(headers) && /AccCode/i.test(headers) && /AccDesc/i.test(headers) &&
        !/Amount|Debit|Credit/i.test(headers),
      `inputs=${await accInputs.count()} rows=${await bodyRows.count()} head="${headers}"`)
    await shot('B-03-dialog')

    const label = t => `${t.values.Code} · ${t.values.Description}`
    const aiRowT = trimmed.find(t => t.key !== handKey && guessedA.includes(t.key))
    if (aiRowT) {
      const tr = dialog.locator('tr').filter({ has: page.locator(`input[aria-label="Account for ${label(aiRowT)}"]`) })
      const acc = tr.locator(`input[aria-label="Account for ${label(aiRowT)}"]`)
      const before = await acc.inputValue()
      const hadTag = await tr.locator('.pms-tag-ai').isVisible()
      const other = await pickOther(acc, before)
      const tagGone = !(await tr.locator('.pms-tag-ai').isVisible())
      const undo = tr.getByRole('button', { name: `Undo ${label(aiRowT)}` })
      const undoShown = await undo.isVisible()
      if (undoShown) await undo.click()
      const back = await acc.inputValue()
      check('B-04', 'AI tag → a hand pick drops it and offers Undo → Undo restores the AI\'s',
        hadTag && other && tagGone && undoShown && back === before && (await tr.locator('.pms-tag-ai').isVisible()),
        `tag=${hadTag} other=${other} gone=${tagGone} undo=${undoShown} back=${back}/${before}`)
    } else check('B-04', 'AI tag / Undo', false, 'no second AI-picked row to drive')

    const approve = dialog.getByRole('button', { name: /Approve and post/ })
    check('B-05', 'a new row without an account blocks Approve and says so',
      (await approve.isDisabled()) && /Pick an account for every new row\./.test(await dialog.innerText()))

    const handTr = dialog.locator('tr').filter({ has: page.locator(`input[aria-label="Account for ${label(hand)}"]`) })
    const deptOk = await pick(handTr.locator(`input[aria-label="Dept for ${label(hand)}"]`), hand.snapshot.dept)
    const accOk = await pick(handTr.locator(`input[aria-label="Account for ${label(hand)}"]`), hand.snapshot.acc)
    const footer = (await dialog.innerText()).replace(/\s+/g, ' ')
    const picks = {}
    for (const t of trimmed) {
      const trT = dialog.locator('tr').filter({ has: page.locator(`input[aria-label="Account for ${label(t)}"]`) })
      picks[t.key] = {
        dept: await trT.locator(`input[aria-label="Dept for ${label(t)}"]`).inputValue(),
        acc: await trT.locator(`input[aria-label="Account for ${label(t)}"]`).inputValue(),
      }
    }
    check('B-06', 'every new row picked (2 by the AI, 1 by hand) → Approve opens, the footer says what it writes',
      deptOk && accOk && (await approve.isEnabled()) &&
        /Adds the new rows \(3\) to Carmen's Comanche mapping, which every later day uses\. Then Carmen posts/i.test(footer),
      `hand=${hand.snapshot.dept}/${hand.snapshot.acc} footer="${(footer.match(/Adds the new rows[^.]*\.[^.]*\./) || [''])[0]}"`)
    await shot('B-06-ready')

    await dialog.getByRole('button', { name: 'Close' }).click()
    const prompt = page.getByRole('dialog').filter({ hasText: 'Leave without posting?' })
    const asked = await prompt.isVisible().catch(() => false) || (await prompt.waitFor({ timeout: 5000 }).then(() => true).catch(() => false))
    if (asked) await prompt.getByRole('button', { name: 'Keep reviewing' }).click()
    const kept = await handTr.locator(`input[aria-label="Account for ${label(hand)}"]`).inputValue()
    check('B-07', 'closing with picks asks first; Keep reviewing keeps them', asked && kept === hand.snapshot.acc, `asked=${asked} kept=${kept}`)

    // B-08: Carmen answers A. Refused (ask K): its own words in the dialog, the day parked,
    // Approve can be pressed again. Posted (K fixed, 2026-11-13): the day is posted with its JV.
    await approve.click()
    const alert = dialog.getByRole('alert').filter({ hasText: /DrCr|Carmen/ })
    let refusal = ''
    let postedA = null
    for (let i = 0; i < 30 && !refusal && !postedA; i++) {
      await page.waitForTimeout(2000)
      const d = keyOf(pyJson('state'), BU, DAY_A)
      if (d?.status === 'posted') postedA = d
      else if (await alert.first().isVisible().catch(() => false)) refusal = await alert.first().innerText()
    }
    const kFixed = !!postedA
    const stillParked = keyOf(pyJson('state'), BU, DAY_A)
    check('B-08', 'Approve → Carmen refuses in its own words (the day stays parked, Approve again possible) or posts it with a JV (ask K fixed)',
      kFixed
        ? !!postedA.jv_no
        : /DrCr value/.test(refusal) && stillParked?.status === 'pending_review' && (await approve.isEnabled()),
      kFixed ? `posted, JV ${postedA.jv_no} (K fixed)` : `alert="${refusal.replace(/\s+/g, ' ').slice(0, 160)}" status=${stillParked?.status}`)
    await shot(kFixed ? 'B-08-posted' : 'B-08-refused')
    if (!kFixed) {
      await dialog.getByRole('button', { name: 'Close' }).click()
      const leave = page.getByRole('dialog').filter({ hasText: 'Leave without posting?' })
      if (await leave.waitFor({ timeout: 5000 }).then(() => true).catch(() => false))
        await leave.getByRole('button', { name: 'Discard changes' }).click()
    }

    const map = pyJson('mapping')
    // The key as carmen_config.key_id writes it: the key columns' values as a JSON array.
    // Python's json.dumps separator (", "), which is how the trimmed keys are written.
    const kid = x => `[${[x.Code, x.Description].map(v => JSON.stringify(String(v ?? ''))).join(', ')}]`
    const nowIdx = Object.fromEntries(map.rows.map(x => [kid(x), x]))
    const sameRest = st.staged.every(x => nowIdx[kid(x)] && nowIdx[kid(x)].DeptCode === x.DeptCode && nowIdx[kid(x)].AccCode === x.AccCode)
    const picksIn = trimmed.every(t => nowIdx[t.key]?.DeptCode === picks[t.key].dept && nowIdx[t.key]?.AccCode === picks[t.key].acc)
    check('B-09', `Carmen's table went back whole before the post: the ${st.staged.length} staged rows + the 3 picks`,
      map.rows.length === st.staged.length + 3 && sameRest && picksIn, `rows=${map.rows.length} rest=${sameRest} picks=${picksIn}`)

    const jvsOf = date => pyJson('jvs').filter(j => String((j.Data || j).JvhDate).slice(0, 10) === date)
    check('B-10', kFixed ? `the posted day has exactly its one JV (${DAY_A}; teardown voids it)` : `a refused day makes no JV (${DAY_A})`,
      jvsOf(DAY_A).length === (kFixed ? 1 : 0), `live=${jvsOf(DAY_A).map(j => (j.Data || j).JvhSeq).join(',')}`)

    // ── C — the other day ───────────────────────────────────────────────────────
    // Re-check after an approve runs only once a day posts; a repeat hook re-reads B and
    // finds its 3 keys mapped by A's write.
    r = await hook(keys[`${BU}/comanche`], 'Comanche', DAY_B)
    const rereadB = await until(rows => {
      const d = keyOf(rows, BU, DAY_B)
      return d?.status === 'pending_review' && d.payload && (d.payload.flags || []).length === 0 ? d : null
    }, 60000)
    await chip('Review')
    const textB2 = (await queueRow(DAY_B).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('C-01', `a repeat hook re-reads ${DAY_B}: A's write mapped its keys, "Ready to post", still waiting (auto-post off)`,
      r.status === 200 && rereadB && /Ready to post/.test(textB2), `flags=${rereadB?.payload?.flags} row="${textB2.slice(0, 100)}"`)

    r = await carmenApi('PUT', '/settings', { uri: URI, bu: BU, pms: 'comanche', auto_post: true })
    const sw2 = await sweep()
    const refusedB = await until(rows => {
      const d = keyOf(rows, BU, DAY_B)
      return d?.reason_code === 'carmen_rejected' || d?.status === 'posted' ? d : null
    }, 60000)
    await chip('Review')
    const refusedText = (await queueRow(DAY_B).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('C-02', `auto-post on → the sweep sends ${DAY_B} to Carmen: refused, the day parks with Carmen's words; or posted (ask K fixed)`,
      r.status === 200 && sw2.status === 200 &&
        (kFixed
          ? refusedB?.status === 'posted' && !!refusedB?.jv_no
          : refusedB?.status === 'pending_review' && /DrCr/.test(refusedB?.error_message || '')),
      `status=${refusedB?.status} reason=${refusedB?.reason_code} jv=${refusedB?.jv_no} error="${refusedB?.error_message}" row="${refusedText.slice(0, 120)}"`)
    await shot(kFixed ? 'C-02-posted' : 'C-02-refused')
    check('C-03', kFixed ? `the auto-posted day has exactly its one JV (${DAY_B}; teardown voids it)` : `a refused day makes no JV (${DAY_B})`,
      jvsOf(DAY_B).length === (kFixed ? 1 : 0))

    r = await hook(keys[`${BU}/comanche`], 'Comanche', DAY_A)
    const refusedA = await until(rows => {
      const d = keyOf(rows, BU, DAY_A)
      return d?.reason_code === 'carmen_rejected' || d?.status === 'posted' ? d : null
    }, 60000)
    check('C-04', kFixed
      ? `a repeat hook for the posted ${DAY_A}: it stays posted, with still just its one JV`
      : `a repeat hook for the refused ${DAY_A}, auto-post on: sent again, refused again, still no JV`,
      r.status === 200 &&
        (kFixed
          ? refusedA?.status === 'posted' && jvsOf(DAY_A).length === 1
          : refusedA?.status === 'pending_review' && /DrCr/.test(refusedA?.error_message || '') && jvsOf(DAY_A).length === 0),
      `status=${refusedA?.status} reason=${refusedA?.reason_code}`)

    // ── D — reject, resend, already posted (a second tenant label, same Carmen BU) ─
    r = await hook(keys[`${BU_B}/comanche`], 'Comanche', DAY_D)
    const dayD = await until(parked(BU_B, DAY_D))
    check('D-01', `the second tenant's ${DAY_D} parks fully mapped`, r.status === 202 && dayD &&
      (dayD.payload?.flags || []).length === 0, `flags=${dayD?.payload?.flags}`)

    await signIn(BU_B)
    let dlg = await openDay(DAY_D)
    await dlg.getByRole('button', { name: 'Reject' }).click()
    await page.getByPlaceholder('e.g. night audit rerun').fill('e2e reject')
    await page.getByRole('button', { name: 'Reject day' }).click()
    const rejSaid = await toast(/Day rejected/)
    const rejected = await until(rows => {
      const d = keyOf(rows, BU_B, DAY_D)
      return d?.status === 'rejected' ? d : null
    }, 30000)
    await chip('Not posted')
    const rejRow = (await queueRow(DAY_D).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('D-02', 'Reject with a reason → Rejected, payload cleared',
      /Day rejected/.test(String(rejSaid)) && rejected?.payload === null && rejected?.error_message === 'e2e reject' && /Rejected/.test(rejRow),
      `row="${rejRow.slice(0, 100)}"`)

    r = await hook(keys[`${BU_B}/comanche`], 'Comanche', DAY_D)
    const back = await until(parked(BU_B, DAY_D))
    check('D-03', 'a repeat hook brings a rejected day back to review', r.status === 200 && back, `status=${back?.status}`)

    dlg = await openDay(DAY_D)
    await page.keyboard.press('Control+Enter')
    const already = await toast(/already posted|Posted to Carmen|Carmen didn't post/i)
    const doneD = await until(rows => {
      const d = keyOf(rows, BU_B, DAY_D)
      return d?.status === 'posted' ? d : null
    }, 60000)
    await chip('Posted')
    const dRow = (await queueRow(DAY_D).innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('D-04', `Ctrl+Enter → Carmen had already posted ${DAY_D}; no new JV`,
      /Carmen had already posted this day/.test(String(already)) && doneD?.reason_code === 'already_posted' &&
        /Carmen had already posted it/.test(dRow) && jvsOf(DAY_D).length === 0,
      `toast=${JSON.stringify(already)} reason=${doneD?.reason_code}`)
    await shot('D-04-already-posted')

    r = await hook(keys[`${BU_B}/comanche`], 'Comanche', DAY_D)
    await sleep(6000)
    const stillD = keyOf(pyJson('state'), BU_B, DAY_D)
    check('D-05', 'a repeat hook for a posted day changes nothing', r.status === 200 && r.json?.duplicate &&
      stillD?.status === 'posted' && jvsOf(DAY_D).length === 0, `status=${stillD?.status}`)

    // ── F-01 — the JV number: a posted day with the seq post_day named in P-03 ─────
    // A posted row stored the way `_process` stores one (with P-03's JV seq): the queue must
    // make its JV number a link, whatever ask K's state.
    const seeded = py('seed-posted').out.trim().split('\n').pop()
    await signIn(BU)
    await chip('Posted')
    const fRow = page.getByRole('row').filter({ hasText: '30/06/2024' }).filter({ hasText: 'Comanche · Daily' })
    const fText = (await fRow.innerText().catch(() => '')).replace(/\s+/g, ' ')
    const href = await fRow.getByRole('link', { name: /Open JV/ }).getAttribute('href').catch(() => null)
    check('F-01', 'a posted PMS day shows its JV number, and Open JV links to that JV in Carmen',
      /^\d+$/.test(seeded) && fText.includes(seeded) && !!href && href.includes(`/glJv/${seeded}/show`),
      `jv_no=${seeded} href=${href} row="${fText.slice(0, 120)}"`)
    await shot('F-01-open-jv')
  } finally {
    await browser.close()
  }
}

async function main() {
  let stopped = null
  const llmBefore = Number(py('llm').out.trim() || 0)
  try {
    await run()
  } catch (e) {
    stopped = e instanceof Stop ? e.message : String(e?.stack || e)
    console.log(`STOP ${stopped}`)
  }
  // ── E — hygiene ───────────────────────────────────────────────────────────────
  check('E-01', 'no uncaught error in the page', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  const log = fs.existsSync(BE_LOG) ? fs.readFileSync(BE_LOG, 'utf8') : ''
  const fives = log.split('\n').filter(l => /"(GET|POST|PUT|DELETE) \/api\/v1\/(pms|carmen\/pms)[^"]*" 5\d\d/.test(l))
  check('E-02', 'no 5xx from the PMS routes', log && fives.length === 0, fives.slice(0, 3).join(' | ') || (log ? '' : 'no log'))
  const llm = Number(py('llm').out.trim() || 0) - llmBefore
  // Up to two calls per day since #57 (a second ask for rows still blank), and a sweep may ask
  // again for a parked day's blank rows.
  check('E-03', 'the AI was asked only for days with new rows (A-01, A-02, A-03)', llm >= 1 && llm <= 6, `calls=${llm}`)

  // ── T — teardown, always ──────────────────────────────────────────────────────
  const td = py('teardown')
  process.stdout.write(td.out)
  for (const line of td.out.trim().split('\n').filter(l => /^(PASS|FAIL) /.test(l)))
    results.push({ id: line.split(' ')[1], name: line, ok: line.startsWith('PASS') })
  for (const [bu, pms] of [[BU, 'comanche'], [BU, 'opera'], [BU_B, 'comanche']]) {
    const q = new URLSearchParams({ uri: URI, bu, pms })
    const r = await carmenApi('DELETE', `/keys?${q}`)
    check('T-03', `revoke ${bu} × ${pms}`, r.status === 204 || r.status === 404, `HTTP ${r.status}`)
    await sleep(3500)
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ stopped, results }, null, 1))
  const failed = results.filter(x => !x.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed${stopped ? ` — STOPPED: ${stopped}` : ''}`)
  process.exit(failed.length || stopped ? 1 : 0)
}

main()
