// Input-field sweep: every page's inputs, typed key by key the way a person types, in a real
// browser against a real backend. Built 2026-11-25 to answer "would a test find the input bug a
// tester found?". The unit tests set whole values with fireEvent.change, so the bugs this hunts
// are the ones that only show up between keystrokes: a field that rewrites itself, focus that
// moves, a cursor that jumps, a refusal whose words are lost.
//
//   backend:  cd backend && IMAP_HOST= venv/Scripts/python.exe -m uvicorn app.main:app --port 8011
//   frontend: a vite config spreading frontend/vite.config.ts with port 3011, /api → 8011
//   node scripts/qa/input_fields_ui.mjs            # SECTIONS=review,late,... to run a subset
//   HEADED=1 SLOWMO=400 node scripts/qa/input_fields_ui.mjs   # watch it in a real window
//
// Evidence (EVIDENCE=0 turns it off): the field under test is outlined in red and a strip along
// the bottom says what is being done and what came of it; every check is screenshotted
// (.playwright-mcp/input-sweep/checks/), every browser context filmed (video/), and
// .playwright-mcp/input-sweep/report.html shows each check with its picture and film.
//
// Sections: review (email review dialog) · late (late input-tax dialog) · pms (PMS day) · ap (AP
// wizard) · manual (credit-card wizard) · mapping · email (email settings) · billing (checkout)
// · admin (dashboard).
//
// Nothing leaves for Carmen or changes shared state. Every non-GET request is answered in the
// browser unless a section explicitly lets it through, and the ones let through are those the
// API refuses with a Pydantic 422 before its handler runs (a body that breaks a max_length),
// which writes nothing. A write nobody expected is answered 599 and reported as UNEXPECTED.
// Extractions are answered with canned readings: no LLM call, no credit.
//
// Each check prints OK (behaves right) or BUG (reproduced). `how` says whether the generic
// edge-case battery would have found it on its own (generic) or the code pointed at it (code).
//
// Env: PLAYWRIGHT_CORE, CHROME_EXE [as security_headers_ui.mjs], APP_URL [http://localhost:3011],
// DOCS_DIR [~/Desktop/demo-mock-docs], CC_BU [carmen], PMS_BU [carmencloud].

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, '.playwright-mcp/input-sweep')
const APP = process.env.APP_URL || 'http://localhost:3011'
const DOCS = process.env.DOCS_DIR || path.join(os.homedir(), 'Desktop/demo-mock-docs')
const CC_BU = process.env.CC_BU || 'carmen'
const PMS_BU = process.env.PMS_BU || 'carmencloud'
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)
const SECTIONS = (process.env.SECTIONS || '').split(',').filter(Boolean)
const want = s => !SECTIONS.length || SECTIONS.includes(s)

const ENV = fs.readFileSync(path.join(ROOT, 'backend/.env'), 'utf8')
const envVar = name => ENV.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()

// ── evidence: what is being tested, where ─────────────────────────────────────
// EVIDENCE (default on): the field under test is outlined in red, a strip along the bottom of
// the page says what is being done to it and then what came of it, every check is
// screenshotted, every browser context is filmed, and report.html puts it all on one page.
// HEADED=1 opens a real window, slowed down (SLOWMO ms, default 250), to watch it live.
const EVIDENCE = process.env.EVIDENCE !== '0'
const HEADED = process.env.HEADED === '1'
const SLOWMO = Number(process.env.SLOWMO || (HEADED ? 250 : 0))
let activePage = null // the page the last action happened on
const pendingShots = []

/** Outline `loc` and caption the strip — what is about to happen, and to which field. */
async function mark(loc, caption) {
  if (!EVIDENCE) return
  await loc
    .evaluate((el, cap) => {
      for (const e of document.querySelectorAll('[data-sweep-mark]')) {
        e.style.outline = e.dataset.sweepOutline || ''
        delete e.dataset.sweepMark
      }
      el.dataset.sweepOutline = el.style.outline
      el.dataset.sweepMark = '1'
      el.style.outline = '3px solid #e11d48'
      el.style.outlineOffset = '2px'
      el.scrollIntoView({ block: 'center', inline: 'nearest' })
      window.__sweepStrip?.(cap, '#1d4ed8')
    }, caption)
    .catch(() => {})
}
// the strip itself, injected into every page
const STRIP = () => {
  window.__sweepStrip = (text, bg) => {
    let b = document.getElementById('__sweep_strip')
    if (!b) {
      b = document.createElement('div')
      b.id = '__sweep_strip'
      Object.assign(b.style, {
        position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483647',
        color: '#fff', font: '600 15px/1.45 system-ui, sans-serif', padding: '8px 14px',
        pointerEvents: 'none', whiteSpace: 'pre-wrap', boxShadow: '0 -2px 8px rgba(0,0,0,.25)',
      })
      document.documentElement.appendChild(b)
    }
    b.style.background = bg
    b.textContent = text
  }
}

// ── reporting ─────────────────────────────────────────────────────────────────
const results = []
function check(id, name, ok, detail = '', how = 'code') {
  const r = { id, section, name, ok: Boolean(ok), detail, how, shot: null, video: null }
  results.push(r)
  console.log(`${ok ? 'OK ' : 'BUG'} ${id.padEnd(6)} ${name}${detail ? `  — ${detail}` : ''}`)
  const page = activePage
  if (!EVIDENCE || !page || page.isClosed()) return
  r.shot = `checks/${String(results.length).padStart(3, '0')}-${id}.png`
  const video = page.video()
  if (video) pendingShots.push(video.path().then(p => (r.video = p), () => {}))
  pendingShots.push(
    page
      .evaluate(([t, bg]) => window.__sweepStrip?.(t, bg), [
        `${ok ? '✔ OK' : '✘ BUG'}  ${id} · ${name}${detail ? `\n${detail}` : ''}`,
        ok ? '#15803d' : '#b91c1c',
      ])
      .then(() => page.screenshot({ path: path.join(SHOTS, r.shot) }))
      .catch(() => (r.shot = null))
  )
}
const note = msg => console.log(`    · ${msg}`)
const shot = async (page, name) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {})

// ── the request gate ──────────────────────────────────────────────────────────
// rules: [{ method, re, handle(route, req) }] — first match wins; GETs pass unless a rule says
// otherwise; any other method without a rule is refused and reported.
const captured = [] // { section, method, url, body }
const unexpected = []
const reactWarnings = new Map() // message → first section it was seen in
let section = 'start'
let rules = []
const allow = (method, re) => ({ method, re, handle: route => route.continue() })
const fake = (method, re, json, status = 200) => ({
  method,
  re,
  handle: route => route.fulfill({ status, json: typeof json === 'function' ? json(route.request()) : json }),
})
const bodyOf = req => {
  try {
    return JSON.parse(req.postData() || 'null')
  } catch {
    return req.postData()
  }
}
const lastBody = re => [...captured].reverse().find(c => re.test(c.url))?.body

async function gate(route) {
  const req = route.request()
  const m = req.method()
  const url = req.url()
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !/\/auth\//.test(url))
    captured.push({ section, method: m, url, body: bodyOf(req) })
  const rule = rules.find(r => (r.method === '*' || r.method === m) && r.re.test(url))
  if (rule) return rule.handle(route, req)
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue()
  unexpected.push(`${section}: ${m} ${url}`)
  return route.fulfill({ status: 599, json: { detail: 'blocked by input sweep' } })
}
const BASE_RULES = [
  allow('POST', /\/api\/v1\/auth\/exchange/),
  allow('POST', /\/api\/v1\/auth\/refresh/),
  // The extractions: canned readings, never the LLM. Sections swap in their own.
  fake('POST', /\/api\/v1\/[^?]*\/suggest/, {}, 503),
  fake('POST', /\/api\/v1\/feedback|\/corrections/, { ok: true }),
  fake('POST', /\/api\/v1\/bug-reports/, { ok: true }),
]

// ── browser plumbing ──────────────────────────────────────────────────────────
let browser
async function newContext(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'Asia/Bangkok',
    locale: 'en-US',
    ...(EVIDENCE ? { recordVideo: { dir: path.join(SHOTS, 'video'), size: { width: 1280, height: 890 } } } : {}),
    ...opts,
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'en')
    } catch {}
  })
  if (EVIDENCE) await ctx.addInitScript(STRIP)
  ctx.on('page', p => {
    activePage = p
    if (!EVIDENCE) return
    // after every navigation, say which section is running
    p.on('load', () => p.evaluate(s => window.__sweepStrip?.(`input sweep · ${s}`, '#334155'), section).catch(() => {}))
  })
  await ctx.route('**/api/**', gate)
  // a check's screenshot is taken in the background: let it land before the browser goes
  const close = ctx.close.bind(ctx)
  ctx.close = async () => {
    await Promise.allSettled(pendingShots)
    return close()
  }
  // React's own warnings (duplicate keys, controlled ↔ uncontrolled, …): the dev build says them out loud
  ctx.on('page', p =>
    p.on('console', m => {
      const text = m.text()
      if (!/Warning:|Encountered two children|controlled|unique "key"/.test(text)) return
      const key = text.split(/\r?\n/)[0].replace(/%s/g, '…').slice(0, 160)
      if (!reactWarnings.has(key)) reactWarnings.set(key, section)
    })
  )
  return ctx
}

async function sso(page, bu) {
  const q = new URLSearchParams({ token: envVar('CARMEN_AUTHORIZATION'), bu, uri: 'https://dev.carmen4.com' })
  // Carmen's token check is a network round trip that now and then stalls: one retry
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${APP}/#/CreditCardOCR?${q}`)
    const ok = await page
      .waitForFunction(() => sessionStorage.getItem('ocr_access_token'), null, { timeout: 45000 })
      .then(() => true, () => false)
    if (ok) return
    if (attempt === 2) throw new Error(`SSO into ${bu} failed twice`)
    await page.goto('about:blank')
  }
}

function adminToken(perms) {
  const code = [
    'import sys; sys.path.insert(0, "backend")',
    'from app.auth.admin_session import create_admin_jwt',
    'from app.services.admin.auth import get_admin_jwt_secret',
    `print(create_admin_jwt("e2e-input-sweep", "e2e-input-sweep", ["superadmin"], ${JSON.stringify(perms)}, get_admin_jwt_secret(), ttl_hours=1))`,
  ].join('\n')
  const out = execFileSync(path.join(ROOT, 'backend/venv/Scripts/python.exe'), ['-c', code], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return out.trim().split('\n').pop()
}

/** One sub-test: a crash is reported and the section carries on. */
async function step(id, fn) {
  try {
    await fn()
  } catch (err) {
    check(id, `could not run: ${String(err.message || err).split(/\r?\n/)[0].slice(0, 140)}`, false, '', 'n/a')
  }
}

/** Select everything in the field and type `text` one key at a time, as a person does. */
async function retype(loc, text, delay = 40) {
  activePage = loc.page()
  const name = await loc
    .evaluate(el => el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.tagName)
    .catch(() => 'field')
  await mark(loc, text === '' ? `clearing "${name}"` : `select all in "${name}", then type "${text}" key by key`)
  await loc.click()
  await loc.press('Control+A')
  if (text === '') await loc.press('Backspace')
  else await loc.page().keyboard.type(text, { delay })
}
const val = loc => loc.inputValue().catch(() => null)
const focusedLabel = page =>
  page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return 'body'
    return el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.tagName
  })
const toasts = page => page.locator('[data-sonner-toast]').allInnerTexts().catch(() => [])
const num = s => Number(String(s ?? '').replace(/,/g, ''))

/** Codes a CustomSearchSelect offers: open it, read the panel, close it. */
async function optionsOf(page, input) {
  await input.click()
  await page.locator('.css-select-panel').first().waitFor({ timeout: 10000 })
  const codes = await page
    .locator('.css-select-panel [role="button"]:not([aria-disabled]) > div:first-child')
    .allInnerTexts()
  await page.keyboard.press('Escape')
  return codes.map(c => c.trim().split(/\s+/)[0]).filter(Boolean)
}

// ══ 1. credit-card review (email queue) ══════════════════════════════════════
async function reviewSection() {
  section = 'review'
  rules = [
    ...BASE_RULES,
    // the review's own writes: answered here, never posted
    fake('PATCH', /\/api\/v1\/config\/accounting/, { ok: true }),
    fake('PUT', /\/api\/v1\/config\/accounting/, { ok: true }),
    // Approve: a body that breaks InputTaxOverrides.tax_id (max 20) goes to the real API,
    // which 422s it before the handler; everything else is answered here.
    {
      method: 'POST',
      re: /\/api\/v1\/email\/review\/[^/]+\/approve|\/email-review\/[^/]+\/approve|\/approve$/,
      handle: (route, req) => {
        const b = bodyOf(req)
        if ((b?.input_tax?.tax_id || '').length > 20) return route.continue()
        return route.fulfill({ json: { jv_no: 'E2E-SWEEP', tax_note: null } })
      },
    },
    fake('POST', /\/reject$/, {}, 204),
  ]
  const ctx = await newContext()
  const page = await ctx.newPage()
  await sso(page, CC_BU)

  // The queue's first pending email document with a JV table.
  const list = await page.evaluate(async () => {
    const t = sessionStorage.getItem('ocr_access_token')
    const r = await fetch('/api/v1/credit-card/activity?filter=review&limit=50&offset=0', {
      headers: { Authorization: `Bearer ${t}` },
    })
    return (await r.json()).data || []
  })
  const doc = list.find(d => d.source === 'email' && d.bank_code === 'SCB') || list.find(d => d.source === 'email')
  if (!doc) return note(`no pending email document on ${CC_BU} — review section skipped`)
  const open = async () => {
    await page.goto(`${APP}/#/CreditCardOCR/review?id=${doc.id}`)
    await page.reload()
    await page.getByRole('dialog').first().waitFor({ timeout: 30000 })
    await page.locator('input.jv-amt').first().waitFor({ timeout: 30000 })
    await page.waitForTimeout(800)
  }
  await open()
  note(`document ${doc.bank_code} ${doc.doc_no}`)
  const dlg = page.getByRole('dialog').first()
  const amounts = dlg.locator('input.jv-amt')
  const legCount = await amounts.count()

  // C1 — type an amount the way a person does: select all, then 1, 2, 0, 0.
  const credit = amounts.filter({ has: page.locator(':scope') }).nth(1)
  const creditLabel = await credit.getAttribute('aria-label')
  await retype(credit, '1200')
  const typed = await val(dlg.getByLabel(creditLabel, { exact: true }))
  check('C1a', `JV amount: select all + type "1200" (${creditLabel})`, num(typed) === 1200, `field shows "${typed}"`, 'generic')
  await shot(page, 'C1-jv-amount-typed')

  // C1b — Backspace at the end of a formatted figure.
  const other = dlg.getByLabel(await amounts.nth(3).getAttribute('aria-label'), { exact: true })
  const before = await val(other)
  await mark(other, `C1b · click "${await other.getAttribute('aria-label')}", press End, then Backspace once`)
  await other.click()
  await other.press('End')
  await other.press('Backspace')
  const afterBs = await val(other)
  check('C1b', 'JV amount: Backspace at the end changes the figure', afterBs !== before, `"${before}" → "${afterBs}"`, 'generic')

  // C1c — clear the field to type a new figure: the leg must not disappear under the cursor.
  const third = dlg.getByLabel(await amounts.nth(2).getAttribute('aria-label'), { exact: true })
  await retype(third, '')
  await page.waitForTimeout(300)
  const legsAfterClear = await amounts.count()
  await mark(dlg.locator('table').first(), `C1c · after clearing one credit: ${legCount} amount fields → ${legsAfterClear}`)
  check('C1c', 'JV amount: clearing a credit keeps the row (so a new figure can be typed)', legsAfterClear === legCount,
    `${legCount} amount fields → ${legsAfterClear}`, 'generic')
  await shot(page, 'C1c-after-clear')

  // C1d — paste a formatted figure.
  await open()
  const pasteInto = dlg.getByLabel(await amounts.nth(0).getAttribute('aria-label'), { exact: true })
  await mark(pasteInto, 'C1d · paste "1,234.50" into the field')
  await pasteInto.click()
  await pasteInto.press('Control+A')
  await page.keyboard.insertText('1,234.50')
  check('C1d', 'JV amount: paste "1,234.50"', num(await val(pasteInto)) === 1234.5, `field shows "${await val(pasteInto)}"`, 'generic')

  // C1e — typing a decimal: "0.05".
  await retype(pasteInto, '0.05')
  const e = await val(pasteInto)
  check('C1e', 'JV amount: type "0.05"', num(e) === 0.05, e === null ? 'the first "0" made the leg 0.00 and the field disappeared' : `field shows "${e}"`, 'generic')

  // C4 — the department / account pickers: type an exact code, then Enter, then Tab.
  await open()
  const dept = dlg.locator('input[aria-label^="Department for"]').last()
  const deptLabel = await dept.getAttribute('aria-label')
  const original = await val(dept)
  const codes = await optionsOf(page, dept)
  const target = codes.find(c => c !== original)
  note(`${deptLabel}: was "${original}", offers ${codes.length} codes, typing "${target}"`)
  if (target) {
    await retype(dept, target)
    await mark(dept, `C4a · typed "${target}" — now press Enter (does it commit?)`)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    await dlg.getByRole('heading').first().click().catch(() => {})
    const afterEnter = await val(dlg.getByLabel(deptLabel, { exact: true }))
    check('C4a', 'Search select: type an exact code + Enter commits it', afterEnter === target, `"${original}" → "${afterEnter}"`, 'generic')
    await shot(page, 'C4a-enter-typed-code')
    await retype(dept, target)
    await mark(dept, `C4b · typed "${target}" — now press Tab (does it commit?)`)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)
    const afterTab = await val(dlg.getByLabel(deptLabel, { exact: true }))
    check('C4b', 'Search select: type an exact code + Tab commits it', afterTab === target, `→ "${afterTab}"`, 'generic')
    // pick with the mouse, then keep typing: the typed text should show
    await mark(dept, 'C4c · pick the first option with the mouse, then type "XY" straight away')
    await dept.click()
    await page.locator('.css-select-panel [role="button"]:not([aria-disabled])').first().click()
    await page.waitForTimeout(150)
    await page.keyboard.type('XY', { delay: 40 })
    const afterPickType = await val(dlg.getByLabel(deptLabel, { exact: true }))
    check('C4c', 'Search select: typing right after a pick shows what is typed', /XY/.test(afterPickType || ''), `field shows "${afterPickType}"`, 'generic')
    await mark(dept, 'C4d · press Escape inside the picker (the review dialog must stay open)')
    await page.keyboard.press('Escape')
    // Escape inside the picker must not close the review dialog
    const dialogStill = await page.getByRole('dialog').first().isVisible()
    check('C4d', 'Search select: Escape in a picker leaves the review dialog open', dialogStill, '', 'generic')
  }

  // C3 / G1 — the input-tax identity fields on the review.
  await step('C3a', async () => {
    await open()
    const showDetails = dlg.getByRole('button', { name: 'Show details' })
    if (await showDetails.isVisible().catch(() => false)) await showDetails.click()
    const taxId = dlg.getByLabel('Tax ID', { exact: true })
    if (!(await taxId.isVisible().catch(() => false))) return note('no Tax ID field on this document')
    await retype(taxId, '0-1075-36000-31-5')
    const approve = dlg.getByRole('button', { name: /Approve and post/ })
    const enabled = await approve.isEnabled()
    check('C3a', 'Input tax: a dashed 17-char tax ID is refused before posting', !enabled,
      `Approve ${enabled ? 'enabled' : 'disabled'} with "${await val(taxId)}"`, 'generic')
    // 25 digits: past the API's max_length, so the real API answers 422 — what does the user read?
    await taxId.fill('0105536000315123456789012')
    await mark(taxId, 'G1a · Tax ID = 25 digits (API allows 20) → press "Approve and post": what does the reviewer read?')
    if (!(await approve.isEnabled())) return note('Approve disabled with a 25-digit tax ID')
    await approve.click()
    const confirm = page.getByRole('button', { name: /^(Post|Approve|Confirm|Yes)/ }).last()
    if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click().catch(() => {})
    await page.waitForTimeout(3000)
    const sent = lastBody(/\/approve$/)
    note(`approve body input_tax = ${JSON.stringify(sent?.input_tax)}`)
    const text = (await dlg.innerText().catch(() => '')) + ' ' + (await toasts(page)).join(' ')
    const objectObject = /\[object Object\]/.test(text)
    const line = text.split('\n').find(l => /object Object|fail|could not|error|refus|invalid|character/i.test(l)) || 'no message found'
    check('G1a', 'Approve refused by a 422: the reviewer reads a real reason', !objectObject && line !== 'no message found',
      `shows: ${line.slice(0, 140)}`, 'generic')
    await shot(page, 'G1a-approve-422')
  })

  // C5 — the reject reason: typed, cancelled, reopened.
  await step('C5', async () => {
    await open()
    await dlg.getByRole('button', { name: 'Reject' }).click()
    const reason = page.getByRole('textbox', { name: /Reason/ }).last()
    await reason.waitFor({ timeout: 5000 })
    await mark(reason, 'C5 · type a reason, press Cancel, open Reject again')
    await reason.fill('typed then cancelled')
    await page.getByRole('button', { name: 'Cancel' }).last().click()
    await dlg.getByRole('button', { name: 'Reject' }).click()
    const again = await val(page.getByRole('textbox', { name: /Reason/ }).last())
    check('C5', 'Reject: a cancelled reason does not come back on reopen', !again, `reopened with "${again}"`, 'generic')
    await page.getByRole('button', { name: 'Cancel' }).last().click()
  })
  await ctx.close()
}

// ══ 2. late input-tax filing dialog (queue row) ══════════════════════════════
async function lateSection() {
  section = 'late'
  rules = [
    ...BASE_RULES,
    {
      method: 'POST',
      re: /\/credit-card\/activity\/[^/]+\/input-tax$/,
      handle: (route, req) => {
        const b = bodyOf(req)
        if ((b?.tax_id || '').length > 20) return route.continue() // the API 422s it, writes nothing
        return route.fulfill({ status: 204, body: '' })
      },
    },
    fake('POST', /\/input-tax\/keyed$/, {}, 204),
  ]
  const ctx = await newContext()
  const page = await ctx.newPage()
  await sso(page, CC_BU)
  await page.goto(`${APP}/#/CreditCardOCR`)
  // the posted rows that still owe their VAT record
  const owing = await page.evaluate(async () => {
    const t = sessionStorage.getItem('ocr_access_token')
    const r = await fetch('/api/v1/credit-card/activity?filter=success&limit=100&offset=0', {
      headers: { Authorization: `Bearer ${t}` },
    })
    return ((await r.json()).data || []).filter(d => d.input_tax_owed)
  })
  if (!owing.length) return note(`nothing owes input tax on ${CC_BU} — late section skipped`)
  note(`card ${owing[0].bank_code} ${owing[0].doc_no}`)
  await page.getByRole('tab', { name: 'All' }).click()
  await page.getByRole('searchbox', { name: 'Search documents' }).fill(owing[0].doc_no)
  const btn = page.getByRole('button', { name: 'Record input tax' }).first()
  await btn.waitFor({ timeout: 20000 })
  await btn.click()
  const dlg = page.getByRole('dialog').first()
  await dlg.getByText('Record input tax in Carmen?').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)

  // a period, so Record is enabled (the state in which a stray Space/Enter files it)
  const period = dlg.getByLabel('Tax period', { exact: true })
  if (await period.isVisible().catch(() => false)) {
    await period.click()
    await page.locator('.css-select-panel [role="button"]:not([aria-disabled])').first().click()
    await page.waitForTimeout(300)
  }
  const vendor = dlg.getByLabel('Vendor', { exact: true })
  await mark(vendor, 'C2a · click Vendor, type one letter "S", wait 250 ms — where is the focus now?')
  await vendor.click()
  await page.keyboard.press('End')
  await page.keyboard.type('S', { delay: 0 })
  await page.waitForTimeout(250)
  // the element itself, not a name: the Vendor input is labelled with a <label>, not aria-label
  const inVendor = await vendor.evaluate(el => el === document.activeElement)
  const focus1 = inVendor ? 'Vendor' : await focusedLabel(page)
  check('C2a', 'Late input tax: focus stays in Vendor after typing one character', inVendor, `focus is on "${focus1}"`, 'generic')
  await shot(page, 'C2-focus-after-one-key')
  const vBefore = await val(vendor)
  await page.keyboard.type('iam', { delay: 120 })
  const vAfter = await val(vendor)
  check('C2b', 'Late input tax: typing "iam" lands in Vendor', vAfter === `${vBefore}iam`, `"${vBefore}" → "${vAfter}"`, 'generic')
  const filed = captured.some(c => c.section === 'late' && /\/input-tax$/.test(c.url))
  check('C2c', 'Late input tax: typing never files the record by itself', !filed, filed ? 'a POST …/input-tax went out while typing' : '', 'generic')

  // C3 — the late dialog's Tax ID and Branch take anything. fill(), not typing: C2 sends
  // every key after the first to the Record button.
  await step('C3b', async () => {
    const taxId = dlg.getByLabel('Tax ID', { exact: true })
    const branch = dlg.getByLabel('Branch', { exact: true })
    await mark(branch, 'C3b · Branch "0000" + Tax ID "0-1075-36000-31-5" — is Record still enabled?')
    await branch.fill('0000')
    await taxId.fill('0-1075-36000-31-5')
    const record = dlg.getByRole('button', { name: 'Record input tax' })
    const recEnabled = await record.isEnabled()
    check('C3b', 'Late input tax: branch "0000" / dashed tax ID refused before filing', !recEnabled, `Record ${recEnabled ? 'enabled' : 'disabled'}`, 'generic')
    // 25 characters → the real API's 422 (LateInputTaxIn.tax_id max 20): what does the user read?
    await taxId.fill('0105536000315123456789012')
    await mark(taxId, 'G1b · Tax ID = 25 digits (API allows 20) → press Record: what does the user read?')
    if (!(await record.isEnabled())) return note('Record disabled with a 25-digit tax ID')
    await record.click()
    await page.waitForTimeout(3000)
    note(`record body = ${JSON.stringify(lastBody(/\/input-tax$/))}`)
    const text = (await toasts(page)).join(' | ') + ' ' + (await dlg.innerText().catch(() => ''))
    const oo = /\[object Object\]/.test(text)
    const line = text.split(/\n| \| /).find(l => /object Object|fail|could not|error|refus|invalid|character|recorded/i.test(l)) || text.slice(0, 120)
    check('G1b', 'Late input tax refused by a 422: the user reads a real reason', !oo && !/recorded/i.test(line), `shows: ${line.slice(0, 140)}`, 'generic')
    await shot(page, 'G1b-late-422')
  })

  // C2d — the dangerous half of C2: a word with a space in it. Focus is on Record by then.
  await step('C2d', async () => {
    await page.keyboard.press('Escape').catch(() => {})
    await page.reload()
    await page.getByRole('tab', { name: 'All' }).click()
    await page.getByRole('searchbox', { name: 'Search documents' }).fill(owing[0].doc_no)
    await page.getByRole('button', { name: 'Record input tax' }).first().click()
    const d = page.getByRole('dialog').first()
    await d.getByText('Record input tax in Carmen?').waitFor({ timeout: 20000 })
    await page.waitForTimeout(600)
    const period = d.getByLabel('Tax period', { exact: true })
    if (await period.isVisible().catch(() => false)) {
      await period.click()
      await page.locator('.css-select-panel [role="button"]:not([aria-disabled])').first().click()
      await page.waitForTimeout(300)
    }
    const n0 = captured.filter(c => /\/input-tax$/.test(c.url)).length
    const vendor = d.getByLabel('Vendor', { exact: true })
    await mark(vendor, 'C2d · select all in Vendor, type "Siam Paper" at a person\'s speed — does the space press Record?')
    await vendor.click()
    await vendor.press('Control+A')
    await page.keyboard.type('Siam Paper', { delay: 120 }) // a person's speed
    await page.waitForTimeout(1500)
    const n1 = captured.filter(c => /\/input-tax$/.test(c.url)).length
    check('C2d', 'Late input tax: typing a vendor name with a space does not file the record', n1 === n0,
      n1 > n0 ? `the space pressed "Record input tax": filed with ${JSON.stringify(lastBody(/\/input-tax$/))}` : `vendor reads "${await val(vendor)}"`, 'generic')
    await shot(page, 'C2d-space-files')
  })
  await ctx.close()
}

// ══ 3. PMS review (a day's new rows) ═════════════════════════════════════════
async function pmsSection() {
  section = 'pms'
  rules = [
    ...BASE_RULES,
    {
      method: 'POST',
      re: /\/pms\/days\/[^/]+\/reject$/,
      handle: (route, req) =>
        (bodyOf(req)?.reason || '').length > 500 ? route.continue() : route.fulfill({ status: 204, body: '' }),
    },
    fake('POST', /\/pms\/days\/[^/]+\/approve$/, { status: 'posted', jv_no: 'E2E' }),
  ]
  const ctx = await newContext()
  const page = await ctx.newPage()
  await sso(page, PMS_BU)
  const days = await page.evaluate(async () => {
    const t = sessionStorage.getItem('ocr_access_token')
    const r = await fetch('/api/v1/credit-card/activity?filter=review&limit=50&offset=0', { headers: { Authorization: `Bearer ${t}` } })
    return ((await r.json()).data || []).filter(d => d.source === 'pms')
  })
  if (!days.length) return note(`no pending PMS day on ${PMS_BU}`)
  const dlg = page.getByRole('dialog').first()
  let day = null
  for (const d of days.slice(0, 6)) {
    await page.goto(`${APP}/#/CreditCardOCR/review?pms=${d.id}`)
    await page.reload()
    const ok = await dlg.locator('input[aria-label^="Account for"]').first()
      .waitFor({ timeout: 25000 }).then(() => true, () => false)
    if (ok) {
      day = d
      break
    }
    note(`day ${d.doc_no}: no editable rows`)
  }
  if (!day) return note('no PMS day with rows to edit')
  note(`day ${day.doc_no}`)

  await step('P1', async () => {
    const acc = dlg.locator('input[aria-label^="Account for"]').first()
    const label = await acc.getAttribute('aria-label')
    const was = await val(acc)
    const codes = await optionsOf(page, acc)
    const target = codes.find(c => c !== was)
    await retype(acc, target)
    await mark(acc, `P1 · typed "${target}" — now press Tab`)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)
    const now = await val(dlg.getByLabel(label, { exact: true }))
    check('P1', 'PMS account picker: type an exact code + Tab keeps it', now === target, `"${was}" → "${now}" (typed "${target}")`, 'generic')
  })

  await step('P2', async () => {
    await dlg.getByRole('button', { name: 'Reject' }).click()
    const box = page.getByRole('textbox', { name: /Reason/ }).last()
    await box.waitFor({ timeout: 5000 })
    await mark(box, 'P2 · reject reason of 600 characters (API allows 500) → press Reject')
    await box.fill('x'.repeat(600))
    await page.getByRole('button', { name: /^Reject/ }).last().click()
    await page.waitForTimeout(2500)
    const text = (await toasts(page)).join(' | ')
    const said = await box.inputValue().catch(() => '(dialog closed)')
    check('P2', 'PMS reject with a 600-char reason: the user is told the limit (500)', /500|long|characters/i.test(text),
      `toast: "${text.slice(0, 120)}", reason box now ${said.length > 20 ? `${said.length} chars` : said}`, 'generic')
    await shot(page, 'P2-pms-reject-600')
  })
  await ctx.close()
}

// ══ 4. AP invoice wizard ═════════════════════════════════════════════════════
const AP_VENDORS = [
  { code: 'C001', name: 'Carmen Telecomunication Co.,Ltd.', taxId: '1234567890123' },
  { code: 'C002', name: 'Carmen Software Co.,Ltd.', taxId: '2345678901234' },
]
function apReading(vendor, over = {}) {
  return {
    id: null,
    vendorName: vendor.name,
    vendorTaxId: vendor.taxId,
    vendorBranch: '00000',
    documentName: 'Tax Invoice',
    documentDate: '20/11/2026',
    documentNumber: `SWEEP-${vendor.code}`,
    taxType: 'Exclude',
    subTotal: 1495.5,
    taxAmount: 104.69,
    totalDiscount: 0,
    grandTotal: 1600.19,
    items: [
      { description: 'Diesel 45.678 L', qty: 45.678, unitPrice: 32.74, discountPct: 0, discountAmt: 0,
        lineSubTotal: 1495.5, taxType: 'Exclude', taxPct: 7, taxAmt: 104.69, lineTotal: 1600.19 },
    ],
    ...over,
  }
}

async function apSection() {
  section = 'ap'
  const queue = [] // the readings /extract hands out, in order
  rules = [
    ...BASE_RULES,
    allow('POST', /\/api\/v1\/files\/pdf-info/), // reads a page count, writes nothing
    { method: 'POST', re: /\/api\/v1\/ap-invoice\/extract/, handle: route => route.fulfill({ json: queue.shift() || apReading(AP_VENDORS[0]) }) },
    fake('PUT', /\/api\/v1\/config\/ap-mapping\//, { ok: true }),
    // Carmen's -1 keeps the wizard on step 4: the body is what we came for
    fake('POST', /\/api\/v1\/carmen\/invoice/, { Code: -1, Message: 'answered by the input sweep' }),
  ]
  const fresh = async () => {
    const ctx = await newContext()
    const page = await ctx.newPage()
    await sso(page, CC_BU)
    await page.goto(`${APP}/#/APInvoice`)
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 20000 })
    return { ctx, page }
  }
  const upload = async page => {
    await page.locator('input[type=file]').first().setInputFiles(path.join(DOCS, 'ap_tax_invoice.pdf'))
    await page.getByRole('button', { name: 'Confirm Field Mapping' }).waitFor({ timeout: 30000 })
  }
  const toStep3 = async page => {
    await page.getByRole('button', { name: 'Confirm Field Mapping' }).click()
    await page.getByRole('button', { name: 'Proceed' }).waitFor({ timeout: 20000 })
    await page.waitForTimeout(800)
  }
  const cell = (page, name) => page.getByRole('textbox', { name, exact: true }).first()

  // A1 — Back to Upload, then a different invoice: whose vendor does step 3 show?
  await step('A1', async () => {
    const { ctx, page } = await fresh()
    queue.push(apReading(AP_VENDORS[0]), apReading(AP_VENDORS[1]))
    await upload(page)
    await toStep3(page)
    const first = await val(page.getByRole('textbox', { name: 'Please select a vendor' }))
    await page.getByRole('button', { name: 'Back to Mapping' }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 10000 })
    await upload(page)
    await toStep3(page)
    const second = await val(page.getByRole('textbox', { name: 'Please select a vendor' }))
    await mark(page.getByRole('textbox', { name: 'Please select a vendor' }), 'A1 · invoice B is from C002 (tax ID 2345678901234) — which vendor is mapped?')
    const taxIdShown = await val(cell(page, 'Tax ID'))
    check('A1', 'AP: Back to Upload + a new invoice picks the new invoice\'s vendor', /C002/.test(second || ''),
      `invoice B (tax ID ${taxIdShown}) shows vendor "${(second || '').slice(0, 60)}" (invoice A had "${(first || '').slice(0, 20)}")`, 'generic')
    await shot(page, 'A1-stale-vendor')
    await ctx.close()
  })

  // A2 — focus "VAT Amount" (From Document) and leave it without typing.
  for (const [id, docTax] of [['A2a', 0], ['A2b', 100]]) {
    await step(id, async () => {
      const { ctx, page } = await fresh()
      queue.push(apReading(AP_VENDORS[0], { taxAmount: docTax, grandTotal: 1495.5 + docTax }))
      await upload(page)
      await toStep3(page)
      const beforeTax = await val(cell(page, 'taxAmt'))
      const beforeType = await page.getByRole('button', { name: 'Tax type' }).first().innerText()
      const vat = page.getByRole('textbox', { name: 'VAT Amount' })
      await mark(vat, `${id} · click into "VAT Amount" (document says ${docTax.toFixed(2)}), then Tab out without typing`)
      await vat.click()
      await page.keyboard.press('Tab')
      await page.waitForTimeout(400)
      const afterTax = await val(cell(page, 'taxAmt'))
      const afterType = await page.getByRole('button', { name: 'Tax type' }).first().innerText()
      await mark(page.locator('tbody tr').first(), `${id} · the line after: tax ${afterTax}, type ${afterType} (before: ${beforeTax}, ${beforeType})`)
      check(id, `AP: click into "VAT Amount" (document says ${docTax.toFixed(2)}) and Tab out — line items unchanged`,
        afterTax === beforeTax && afterType === beforeType,
        `line tax ${beforeTax} → ${afterTax}, tax type ${beforeType} → ${afterType}`, 'generic')
      await shot(page, `${id}-vat-blur`)
      await ctx.close()
    })
  }

  // A3/A4/A5/A7 — one invoice: tab through qty, the numeric battery, Ctrl+Enter, the payload.
  await step('A3', async () => {
    const { ctx, page } = await fresh()
    queue.push(apReading(AP_VENDORS[0], { documentDate: '' }))
    await upload(page)
    await toStep3(page)
    const sub0 = await val(cell(page, 'lineSubTotal'))
    await mark(cell(page, 'qty'), 'A3 · click into Qty (45.678 shown as 45.68), then Tab out without typing')
    await cell(page, 'qty').click()
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)
    await mark(cell(page, 'lineSubTotal'), `A3 · Line Sub Total was ${sub0}`)
    const sub1 = await val(cell(page, 'lineSubTotal'))
    check('A3', 'AP: Tab through Qty without typing leaves Line Sub Total as extracted', sub1 === sub0, `${sub0} → ${sub1} (qty 45.678 shown as 45.68)`, 'generic')

    // the numeric battery on Unit Price
    const up = cell(page, 'unitPrice')
    await retype(up, '1200')
    check('N1', 'AP number cell: select all + type "1200"', num(await val(up)) === 1200, `shows "${await val(up)}"`, 'generic')
    await retype(up, '0.05')
    check('N2', 'AP number cell: type "0.05"', num(await val(up)) === 0.05, `shows "${await val(up)}"`, 'generic')
    await mark(up, 'N3 · paste " 1 234,50 " into Unit Price, then Tab')
    await up.click()
    await up.press('Control+A')
    await page.keyboard.insertText(' 1 234,50 ')
    await page.keyboard.press('Tab')
    check('N3', 'AP number cell: paste " 1 234,50 " is not read as 123,450', num(await val(up)) !== 123450, `reads "${await val(up)}"`, 'generic')
    await mark(up, 'N4 · paste "(500)" (accounting negative) into Unit Price, then Tab')
    await up.click()
    await up.press('Control+A')
    await page.keyboard.insertText('(500)')
    await page.keyboard.press('Tab')
    check('N4', 'AP number cell: paste "(500)" (accounting negative) keeps the sign or refuses', num(await val(up)) !== 500, `reads "${await val(up)}"`, 'generic')
    await retype(cell(page, 'qty'), '-3')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)
    check('N5', 'AP qty: a negative quantity is refused', num(await val(cell(page, 'qty'))) >= 0, `qty "${await val(cell(page, 'qty'))}", sub total "${await val(cell(page, 'lineSubTotal'))}"`, 'generic')

    // A4 — Ctrl+Enter straight from a cell being typed in
    await retype(cell(page, 'qty'), '1')
    await page.keyboard.press('Tab')
    await retype(up, '100')
    await page.keyboard.press('Tab')
    await retype(cell(page, 'qty'), '2') // not left: Ctrl+Enter from inside the cell
    await mark(cell(page, 'qty'), 'A4 · Qty = 2 typed, still inside the cell → press Ctrl+Enter')
    await page.keyboard.press('Control+Enter')
    await page.waitForTimeout(800)
    // the totals no longer match the document: a "continue anyway?" dialog comes first
    const anyway = page.getByRole('dialog').getByRole('button', { name: 'Proceed' })
    if (await anyway.isVisible().catch(() => false)) await anyway.click()
    await page.waitForTimeout(1200)
    const onStep4 = await page.getByRole('button', { name: 'Generate AP Invoice' }).isVisible().catch(() => false)
    note(`Ctrl+Enter moved to step 4: ${onStep4}`)
    if (onStep4) {
      // pick a dept + account so Generate is enabled, then read the body Carmen would get
      for (const name of ['Dept code/name', 'Account code/name']) {
        const box = page.getByRole('textbox', { name }).first()
        await box.click()
        await page.locator('.css-select-panel [role="button"]:not([aria-disabled])').first().click()
        await page.waitForTimeout(300)
      }
      await page.getByRole('button', { name: 'Generate AP Invoice' }).click()
      const confirm = page.getByRole('button', { name: /^(Generate|Confirm|Post|Yes)/ }).last()
      if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click().catch(() => {})
      await page.waitForTimeout(2500)
      const body = lastBody(/\/carmen\/invoice/)
      const line = body?.Detail?.[0] || body?.detail?.[0] || {}
      const hdr = body?.Header || body?.header || body || {}
      note(`invoice body: InvdQty=${line.InvdQty} InvdPrice=${line.InvdPrice} NetAmt=${line.NetAmt ?? line.InvdNetAmt} InvhInvDate=${hdr.InvhInvDate} VnCode=${hdr.VnCode}`)
      check('A4', 'AP: Ctrl+Enter from a Qty cell posts qty × price as typed (2 × 100)', Number(line.InvdQty) === 2 && Math.abs(Number(line.InvdPrice) - 100) < 0.01,
        `InvdQty ${line.InvdQty}, InvdPrice ${line.InvdPrice}`, 'code')
      const today = new Date().toISOString().slice(0, 10)
      check('A7', 'AP: an invoice with no document date is not posted as today', !String(hdr.InvhInvDate || '').startsWith(today),
        `InvhInvDate ${hdr.InvhInvDate}`, 'code')
    } else check('A4', 'AP: Ctrl+Enter reached step 4', false, 'did not move', 'code')
    await shot(page, 'A4-step4')
    await ctx.close()
  })

  // A6 — the vendor search box empties when focused while the badge still says Mapped
  await step('A6', async () => {
    const { ctx, page } = await fresh()
    queue.push(apReading(AP_VENDORS[0]))
    await upload(page)
    await toStep3(page)
    const box = page.getByRole('textbox', { name: 'Please select a vendor' })
    await mark(box, 'A6 · click into the vendor search box (vendor already mapped)')
    await box.click()
    await page.waitForTimeout(300)
    const v = await val(box)
    const mapped = await page.getByText('Mapped', { exact: true }).isVisible().catch(() => false)
    check('A6', 'AP vendor search: focusing keeps the chosen vendor visible', !(v === '' && mapped), `box "${v}", badge Mapped ${mapped}`, 'generic')
    await ctx.close()
  })
}

// ══ 5. credit-card manual wizard ═════════════════════════════════════════════
function ccReading(over = {}) {
  return [{
    id: '', task_id: '', bank_name: 'SCB', doc_name: 'SCB statement', company_name: 'Carmen',
    doc_date: '20/11/2026', doc_no: 'SWEEP-CC-1', merchant_name: 'SWEEP', merchant_id: '123456789', branch_no: '00000',
    // the bank's registered name is what detects SCB, and with it SCB's payment-type mapping
    bank_company_name: 'Siam Commercial Bank Public Company Limited',
    details: [
      { transaction: 'Online Payment Services', pay_amt: '10,470.00', commis_amt: '209.40', tax_amt: '14.66', total: '10,245.94' },
      { transaction: 'Online Payment Services', pay_amt: '5,645.00', commis_amt: '112.90', tax_amt: '7.90', total: '5,524.20' },
    ],
    ...over,
  }]
}

async function manualSection() {
  section = 'manual'
  const queue = []
  rules = [
    ...BASE_RULES,
    allow('POST', /\/api\/v1\/files\/pdf-info/),
    { method: 'POST', re: /\/api\/v1\/credit-card\/extract/, handle: route => route.fulfill({ json: queue.shift() || ccReading() }) },
    fake('POST', /\/api\/v1\/carmen\/gljv/, { Code: 0, Id: [999001], Message: 'answered by the input sweep' }),
    fake('POST', /\/api\/v1\/carmen\/input-tax/, { Code: 0, Id: [999002] }),
    fake('PATCH', /\/api\/v1\/config\/accounting/, { ok: true }),
    fake('PUT', /\/api\/v1\/config\/accounting/, { ok: true }),
  ]
  let ctx = await newContext()
  let page = null
  // A fresh browser per case: the wizard keeps a draft, and a restored draft is not the
  // screen a person starts from.
  const start = async reading => {
    queue.push(reading)
    await ctx.close()
    ctx = await newContext()
    page = await ctx.newPage()
    await sso(page, CC_BU)
    await page.goto(`${APP}/#/CreditCardOCR/manual`)
    await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 20000 })
    await page.locator('input[type=file]').first().setInputFiles(path.join(DOCS, 'scb_card_report.pdf'))
    await page.getByRole('textbox', { name: 'PayAmt' }).first().waitFor({ timeout: 30000 })
  }

  await step('W1', async () => {
    await start(ccReading())
    const pay = page.getByRole('textbox', { name: 'PayAmt' }).first()
    // the numeric battery
    await retype(pay, '1200')
    check('N6', 'Manual details: select all + type "1200"', num(await val(pay)) === 1200, `shows "${await val(pay)}"`, 'generic')
    // edit in the middle: put the caret after "12", type "3" then ","
    await retype(pay, '12000')
    await mark(pay, 'W1 · put the caret after "12", type "3" then "," — does the caret stay?')
    await pay.press('Home')
    await pay.press('ArrowRight')
    await pay.press('ArrowRight')
    await page.keyboard.type('3')
    const caret1 = await pay.evaluate(el => el.selectionStart)
    await page.keyboard.type(',')
    const caret2 = await pay.evaluate(el => el.selectionStart)
    check('W1', 'Manual details: typing in the middle keeps the caret where it was', caret1 === 3 && caret2 === 4,
      `after "3" caret ${caret1} (want 3), after "," caret ${caret2} (want 4), value "${await val(pay)}"`, 'generic')
    // Thai keyboard layout: the keys 3 0 0 type "-จจ"
    await mark(pay, 'W5 · Thai keyboard layout: the keys 3-0-0 type "-จจ"')
    await pay.click()
    await pay.press('Control+A')
    for (const ch of '-จจ') await page.keyboard.insertText(ch)
    await page.keyboard.press('Tab')
    check('W5', 'Manual details: Thai-layout keys for "300" do not leave a stray "-" behind', !/^-?$/.test((await val(pay)) || ''),
      `field reads "${await val(pay)}" after typing -จจ`, 'generic')
  })

  await step('W2', async () => {
    await start(ccReading())
    const tx = page.getByRole('textbox', { name: 'Transaction' }).first()
    await retype(tx, 'online payment services ') // the BU's mapped type, in lower case + a trailing space
    await page.getByRole('button', { name: 'Next (Review Accounting)' }).click()
    await page.waitForTimeout(2500)
    const body = await page.locator('body').innerText()
    const line = body.split('\n').find(l => /missing account mapping/i.test(l)) || ''
    const banner = page.getByText(/Missing account mapping/i).first()
    if (await banner.isVisible().catch(() => false)) await mark(banner, `W2 · step 3 says: ${line}`)
    // control: the untouched row, typed as extracted, must be mapped — else the test proves nothing
    const control = !/Online Payment Services/.test(line)
    note(`step 3 says: "${line || 'no missing mapping'}"`)
    check('W2', 'Manual: payment type "online payment services " (case/space) still finds its mapping', control && !/online payment/i.test(line),
      control ? (line ? line.slice(0, 100) : 'mapped') : 'control failed: the untouched row is unmapped too', 'generic')
    await shot(page, 'W2-case-mapping')
  })

  await step('W3', async () => {
    await start(ccReading({ doc_date: '' }))
    const docDate = page.getByRole('button', { name: 'DocDate' })
    await mark(docDate, 'W3 · the document has no date — follow it to input tax')
    note(`DocDate reads "${(await docDate.innerText().catch(() => '')).trim()}"`)
    await page.getByRole('button', { name: 'Next (Review Accounting)' }).click()
    await page.waitForTimeout(2500)
    const post = page.getByRole('button', { name: /Post|Submit|Send to Carmen/ }).last()
    if (!(await post.isEnabled().catch(() => false))) return note('step 3 post button not enabled — W3 not reached')
    await post.click()
    const confirm = page.getByRole('dialog').getByRole('button', { name: /^(Post|Confirm|Yes|Submit)/ }).last()
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click()
    await page.waitForTimeout(3000)
    const jv = lastBody(/\/carmen\/gljv/)
    note(`JV body date fields: ${JSON.stringify(Object.fromEntries(Object.entries(jv?.Header || jv || {}).filter(([k]) => /date/i.test(k))))}`)
    const add = page.getByRole('button', { name: /Add Input Tax|Record input tax|Post input tax/i }).first()
    const addOn = await add.isEnabled().catch(() => false)
    if (addOn) {
      await add.click()
      const c2 = page.getByRole('dialog').getByRole('button', { name: /^(Post|Confirm|Yes|Submit|Add)/ }).last()
      if (await c2.isVisible({ timeout: 2000 }).catch(() => false)) await c2.click()
      await page.waitForTimeout(2500)
    }
    const itx = lastBody(/\/carmen\/input-tax/)
    const flat = JSON.stringify(itx || {})
    const fr = flat.match(/"FrDate":"([^"]*)"/)?.[1]
    const prefix = flat.match(/"Prefix":"([^"]*)"/)?.[1]
    check('W3', 'Manual: a document with no date is stopped before input tax, not filed with a broken period',
      !itx || (fr && !/^0-|--/.test(fr)), itx ? `input tax sent with FrDate "${fr}", Prefix "${prefix}"` : `input-tax button ${addOn ? 'pressed, nothing sent' : 'disabled'}`, 'code')
    await shot(page, 'W3-no-date')
  })
  await ctx.close()
}

// ══ 6. mapping page ══════════════════════════════════════════════════════════
async function mappingSection() {
  section = 'mapping'
  rules = [
    ...BASE_RULES,
    fake('PUT', /\/api\/v1\/config\//, { ok: true }),
    fake('PATCH', /\/api\/v1\/config\//, { ok: true }),
    fake('POST', /\/api\/v1\/config\//, { ok: true }),
  ]
  const ctx = await newContext()
  const page = await ctx.newPage()
  await sso(page, CC_BU)
  await page.goto(`${APP}/#/CreditCardOCR/mapping`)
  await page.reload()
  await page.getByRole('textbox', { name: 'Branch No' }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)

  await step('M1', async () => {
    const branch = page.getByRole('textbox', { name: 'Branch No' })
    await retype(branch, ' 1234')
    await page.getByRole('button', { name: 'Save & Close' }).click()
    await page.waitForTimeout(1500)
    const sent = lastBody(/\/config\/accounting/)
    check('M1', 'Mapping: branch " 1234" is refused (5 digits)', !sent || !/ ?1234$/.test(sent.branch || ''),
      sent ? `saved branch "${sent.branch}"` : 'not saved', 'generic')
  })

  await step('C6', async () => {
    await page.goto(`${APP}/#/CreditCardOCR/mapping`)
    await page.reload()
    const open = page.getByRole('button', { name: /Account Receivable \/ Bank/ })
    await open.waitFor({ timeout: 30000 })
    await open.click()
    const dlg = page.getByRole('dialog').first()
    await dlg.waitFor({ timeout: 10000 })
    const search = dlg.getByRole('searchbox').first()
    if (!(await search.isVisible().catch(() => false))) return note('payment-type dialog has no search box')
    await mark(search, 'C6 · type "VSA" in the payment-type search, then press Escape')
    await search.fill('VSA')
    await search.press('Escape')
    await page.waitForTimeout(400)
    const still = await dlg.isVisible().catch(() => false)
    check('C6', 'Payment-type dialog: Escape in its search box clears the search, not the whole dialog', still,
      still ? '' : 'the dialog closed (and its edits with it)', 'generic')
  })
  await ctx.close()
}

// ══ 7. email settings ════════════════════════════════════════════════════════
async function emailSection() {
  section = 'email'
  // A save is answered with what the real GET says — the same body the real PUT returns — so
  // the page carries on as it would, and nothing is written. Likewise the token offer.
  const answerWithGet = path => async (route, req) => {
    const b = bodyOf(req) || {}
    const url = `${APP}/api/v1/carmen/${path}?uri=${encodeURIComponent(b.uri)}&bu=${encodeURIComponent(b.bu)}`
    const res = await ctx.request.get(url, { headers: { Authorization: req.headers().authorization || '' } })
    return route.fulfill({ status: res.status(), json: await res.json().catch(() => ({})) })
  }
  rules = [
    ...BASE_RULES,
    { method: 'PUT', re: /\/api\/v1\/carmen\/settings\/token/, handle: answerWithGet('settings/token') },
    { method: 'PUT', re: /\/api\/v1\/carmen\/settings$/, handle: answerWithGet('settings') },
  ]
  const ctx = await newContext()
  const page = await ctx.newPage()
  await sso(page, CC_BU)
  await page.goto(`${APP}/#/CreditCardOCR/email-settings`)
  await page.reload()
  const taxIds = page.getByRole('textbox', { name: /Company tax IDs/ })
  await taxIds.waitFor({ timeout: 30000 })

  await step('E1', async () => {
    const was = await val(taxIds)
    await mark(taxIds, 'E1 · paste two tax IDs from a spreadsheet row (tab-separated), then Save')
    await taxIds.fill(`${was}\t0105536000127`) // a row pasted from a spreadsheet: tab-separated
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.waitForTimeout(1500)
    const sent = lastBody(/\/carmen\/settings/)
    note(`tax_ids sent: ${JSON.stringify(sent?.tax_ids)}`)
    check('E1', 'Email settings: two tax IDs pasted tab-separated are read as two', Array.isArray(sent?.tax_ids) && sent.tax_ids.length === 2,
      `sent ${JSON.stringify(sent?.tax_ids)}`, 'generic')
  })

  await step('E2', async () => {
    await page.reload()
    await page.getByRole('button', { name: /^Rule 1:/ }).click()
    const dlg = page.getByRole('dialog').first()
    const pw = dlg.locator('input[type="password"]').first()
    await pw.waitFor({ timeout: 10000 })
    note(`password field shows "${await val(pw)}" (placeholder "${await pw.getAttribute('placeholder')}")`)
    await mark(pw, 'E2 · Rule 1 has a stored PDF password — try to remove it (empty the field, save)')
    await pw.fill('')
    await dlg.getByRole('button', { name: /^(Save|Done|Apply|Update)/ }).last().click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Save changes' }).click().catch(() => {})
    await page.waitForTimeout(1500)
    const sent = lastBody(/\/carmen\/settings/)
    const rule = sent?.rules?.[0]
    check('E2', 'Email settings: a stored PDF password can be removed', rule && rule.pdf_password === '',
      rule ? `rule 1 sent pdf_password ${JSON.stringify(rule.pdf_password)} (null = keep the stored one)` : 'nothing saved', 'code')
  })
  await ctx.close()
}

// ══ 8. checkout ══════════════════════════════════════════════════════════════
async function billingSection() {
  section = 'billing'
  rules = [
    ...BASE_RULES,
    {
      method: 'POST',
      re: /\/api\/v1\/credits\/orders$/,
      // A 12-digit tax ID fails BuyerInfoInput, a Pydantic 422 before the handler: let the real
      // API answer it. Anything else would create an order: refuse it here.
      handle: (route, req) => {
        const tid = String(bodyOf(req)?.buyer?.tax_id ?? bodyOf(req)?.buyer_override?.tax_id ?? bodyOf(req)?.tax_id ?? '')
        return /^\d{12}$/.test(tid) ? route.continue() : route.fulfill({ status: 400, json: { detail: 'order refused by the input sweep' } })
      },
    },
  ]
  const ctx = await newContext()
  const page = await ctx.newPage()
  await sso(page, CC_BU)
  await page.goto(`${APP}/#/pricing`)
  await page.reload()
  await page.getByRole('button', { name: 'Choose Lite' }).click()
  await page.getByRole('textbox', { name: 'Tax ID *' }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(1500)

  await step('B1', async () => {
    const f = n => page.getByRole('textbox', { name: n })
    await f('Company / buyer name *').fill('  Sweep Test Co.  ')
    await mark(f('Tax ID *'), 'B1 · Tax ID with 12 digits, email "a@b", name with spaces around it → Continue to payment')
    await f('Tax ID *').fill('010553600012') // 12 digits
    await f('Branch *').fill('00000')
    await f('Address *').fill('1 Test Road')
    await f('Email').fill('a@b')
    await page.getByRole('button', { name: 'Continue to payment' }).click()
    const warn = page.getByRole('dialog').getByRole('button', { name: /Continue|Confirm|Yes/ }).last()
    if (await warn.isVisible({ timeout: 1500 }).catch(() => false)) await warn.click()
    await page.waitForTimeout(3000)
    const sent = captured.filter(c => /\/credits\/orders$/.test(c.url)).pop()?.body
    note(`order body buyer: ${JSON.stringify(sent?.buyer || sent?.buyer_override || sent)}`.slice(0, 300))
    const text = (await toasts(page)).join(' | ')
    check('B1', 'Checkout: a 12-digit tax ID — the buyer is told why (13 digits)', /13|digit|tax id/i.test(text) && !/object Object/.test(text),
      `toast: "${text.slice(0, 140)}"`, 'generic')
    await shot(page, 'B1-checkout-422')
    const buyer = sent?.buyer || sent?.buyer_override || {}
    check('B2', 'Checkout: buyer name is sent trimmed', !buyer.name || buyer.name === buyer.name.trim(), `name sent as ${JSON.stringify(buyer.name)}`, 'generic')
  })
  await ctx.close()
}

// ══ 9. admin dashboard ═══════════════════════════════════════════════════════
const ADMIN_PERMS = ['admin_users', 'alerts', 'api_keys', 'banks', 'configs', 'modules', 'orders', 'quotas', 'roles', 'tenants']
  .flatMap(r => [`${r}:read`, `${r}:write`])
let adminJwt = null
async function adminPage(opts = {}) {
  adminJwt ??= adminToken(ADMIN_PERMS)
  const ctx = await newContext(opts.context)
  if (opts.clock) await ctx.addInitScript(() => {}) // keep ordering explicit
  if (!opts.signedOut)
    await ctx.addInitScript(t => sessionStorage.setItem('ocr_admin_token', t), adminJwt)
  const page = await ctx.newPage()
  if (opts.clock) await page.clock.install({ time: new Date(opts.clock) })
  return { ctx, page }
}
const go = async (page, hash) => {
  await page.goto(`${APP}/${hash}`)
  await page.reload()
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
}

async function adminSection() {
  section = 'admin'
  rules = [
    ...BASE_RULES,
    // a wrong password for a user that does not exist: a real 401, locks nobody out
    { method: 'POST', re: /\/api\/v1\/admin\/auth\/login/, handle: (route, req) =>
      /^sweep-nobody/.test(bodyOf(req)?.username || '') ? route.continue() : route.fulfill({ status: 599, json: {} }) },
    fake('POST', /\/admin\/tenants\/[^/]+\/credits\/(adjust|topup)/, { ok: true, balance: 0 }),
    fake('POST', /\/admin\/credit-orders\/[^/]+\/(hold|reject|approve|cancel)/, { ok: true }),
    fake('POST', /\/admin\/admin-users\/[^/]+\/password-reset/, { ok: true }),
    // AR code: only a code the schema refuses (pattern / max 15) goes to the real API → 422
    { method: '*', re: /\/admin\/ar-customer-profiles\/[^/]+$|\/ar-profiles\/[^/]+$/, handle: (route, req) => {
      if (route.request().method() === 'GET') return route.continue()
      const code = String(bodyOf(req)?.carmen_ar_code ?? '')
      return !/^[A-Za-z0-9-]{0,15}$/.test(code) ? route.continue() : route.fulfill({ json: { ok: true } })
    } },
  ]

  // X1 — Period → "Custom range…"
  await step('X1', async () => {
    const { ctx, page } = await adminPage()
    await go(page, '#/admin/llm-logs')
    const period = page.getByRole('combobox', { name: 'Period' })
    await mark(period, 'X1 · choose "Custom range…" in Period')
    await period.selectOption({ label: 'Custom range…' })
    await page.waitForTimeout(500)
    const dates = await page.locator('input[type="date"]').count()
    const shown = await period.evaluate(el => el.options[el.selectedIndex].text)
    check('X1', 'Admin period: choosing "Custom range…" opens the date fields', dates >= 2, `${dates} date fields, select shows "${shown}"`, 'generic')
    await shot(page, 'X1-custom-range')

    // X12 — reach a custom range through the URL, then clear "To"
    const reqs = []
    page.on('request', r => /\/api\/v1\/admin\/llm/.test(r.url()) && reqs.push(r.url()))
    await go(page, '#/admin/llm-logs?from=2026-10-01&to=2026-10-31')
    const to = page.locator('input[type="date"]').nth(1)
    if (await to.isVisible().catch(() => false)) {
      await mark(to, 'X12 · a custom range opened from the URL — clear "To"')
      await to.fill('')
      await page.waitForTimeout(1500)
      const last = decodeURIComponent(reqs.at(-1) || '')
      const t = (await toasts(page)).join(' | ')
      check('X12', 'Admin custom range: clearing "To" does not send a broken date', !/=T23:59:59|to=&|to=$/.test(last) && !t,
        `request ${last.replace(/^.*\?/, '?').slice(0, 120)}${t ? ` · toast "${t.slice(0, 80)}"` : ''}`, 'generic')
    } else note('custom range via URL did not open the date fields')
    await ctx.close()
  })

  // X2 — Extractions / Quotas at 00:30 ICT on the 1st of a month
  for (const [id, hash, apiRe] of [['X2a', '#/admin/extractions', /\/admin\/[^?]*(extraction|ocr-task|failure)/], ['X2b', '#/admin/quota-modules', /\/admin\/quotas/]]) {
    await step(id, async () => {
      const { ctx, page } = await adminPage({ clock: '2026-12-01T00:30:00+07:00' })
      const reqs = []
      page.on('response', r => apiRe.test(r.url()) && reqs.push(`${r.status()} ${decodeURIComponent(r.url()).replace(/^.*\/api\/v1/, '')}`))
      await go(page, hash)
      await mark(page.locator('main h1, main h2').first(), `${id} · browser clock set to 00:30 ICT, 1 Dec 2026`)
      await page.waitForTimeout(1500)
      const t = (await toasts(page)).join(' | ')
      const bad = reqs.find(r => !r.startsWith('2'))
      const dated = reqs.find(r => /from=|to=|start=|end=/.test(r)) || reqs[0] || 'no request seen'
      check(id, `Admin ${hash.split('/').pop()} at 00:30 ICT on 1 Dec: loads, and "to" is today (2026-12-01)`, !bad && !t && /2026-12-01/.test(dated),
        `${bad || dated}${t ? ` · toast "${t.slice(0, 80)}"` : ''}`.slice(0, 220), 'code')
      await shot(page, `${id}-0030`)
      await ctx.close()
    })
  }

  // X3/X4 — client-side table search on Tenants
  await step('X3', async () => {
    const { ctx, page } = await adminPage()
    await go(page, '#/admin/tenants')
    const search = page.getByRole('searchbox', { name: 'Search host, BU, or name…' })
    // X4 first: page 3, then a search that matches many
    const next = page.getByRole('button', { name: 'Next page' })
    if (await next.isEnabled().catch(() => false)) {
      await next.click()
      if (await next.isEnabled().catch(() => false)) await next.click()
      await mark(search, 'X4 · on page 3 of the table, search "dev"')
      await search.fill('dev')
      await page.waitForTimeout(800)
      const pager = await page.locator('.pager, [class*="pager"]').first().innerText().catch(() => '')
      const prevOn = await page.getByRole('button', { name: 'Previous page' }).isEnabled().catch(() => false)
      check('X4', 'Admin Tenants: a new search starts from page 1', !prevOn, `pager "${pager.replace(/\s+/g, ' ').slice(0, 60)}", Previous ${prevOn ? 'enabled' : 'disabled'}`, 'generic')
    } else note('Tenants has a single page — X4 not reachable')
    await search.fill('')
    await page.waitForTimeout(500)
    const name = 'dev.carmen4.com/carmen'
    await mark(search, `X3 · search the tenant's name "${name}"`)
    await search.fill(name)
    await page.waitForTimeout(800)
    const rows = await page.locator('tbody tr').count()
    const empty = /no (results|data|tenants)|nothing/i.test(await page.locator('main').innerText())
    check('X3', `Admin Tenants: search "${name}" (the tenant's name) finds it`, rows > 0 && !empty, `${empty ? 'no rows' : `${rows} rows`}`, 'generic')
    await ctx.close()
  })

  // X6 — reset-password dialog: show-password, then type
  await step('X6', async () => {
    const { ctx, page } = await adminPage()
    await go(page, '#/admin/admin-users')
    await page.getByRole('button', { name: 'Expand' }).first().click()
    await page.getByRole('button', { name: /Reset password/i }).first().click()
    const dlg = page.getByRole('dialog').first()
    const pw = dlg.locator('input').first()
    await pw.waitFor({ timeout: 5000 })
    await pw.type('Ab', { delay: 50 })
    const eye = dlg.getByRole('button', { name: /show|reveal|password/i }).first()
    await mark(pw, 'X6 · typed "Ab", press the show-password eye, then type one more letter')
    await eye.click()
    const t1 = await pw.getAttribute('type')
    await pw.type('c', { delay: 50 })
    const t2 = await pw.getAttribute('type')
    check('X6', 'Admin reset password: "show password" stays on while typing', t1 === 'text' && t2 === 'text', `after eye: ${t1}, after one more key: ${t2}`, 'generic')
    await shot(page, 'X6-reset-password')
    await ctx.close()
  })

  // X7 — Performance opened on page 3
  await step('X7', async () => {
    const { ctx, page } = await adminPage()
    const reqs = []
    page.on('request', r => /\/api\/v1\/admin\/performance/.test(r.url()) && reqs.push(decodeURIComponent(r.url())))
    await go(page, '#/admin/performance?offset=30')
    await mark(page.locator('main h1, main h2').first(), 'X7 · opened from a link to page 3 (?offset=30)')
    await page.waitForTimeout(1500)
    const offsets = reqs.map(u => u.match(/offset=(\d+)/)?.[1] ?? '0')
    check('X7', 'Admin Performance: a link to page 3 (offset=30) stays on page 3', offsets.at(-1) === '30' && /offset=30/.test(page.url()),
      `requests asked offsets [${offsets.join(', ')}], URL now ${page.url().replace(/^.*#/, '#')}`, 'generic')
    await ctx.close()
  })

  // X8 — admin login: a wrong password, then where is the caret?
  await step('X8', async () => {
    const { ctx, page } = await adminPage({ signedOut: true })
    await go(page, '#/admin/login')
    await page.getByRole('textbox', { name: /user/i }).first().fill('sweep-nobody')
    const pw = page.locator('input[type="password"]').first()
    await mark(pw, 'X8 · a wrong password, press Enter — where is the caret afterwards?')
    await pw.fill('wrong-password')
    await pw.press('Enter')
    await page.waitForResponse(r => /admin\/auth\/login/.test(r.url()), { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(800)
    const focused = await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute('type') || ''}`)
    check('X8', 'Admin login: after a wrong password the caret is back in the password field', /INPUT password/.test(focused), `focus on ${focused}`, 'generic')
    await ctx.close()
  })

  // X9 — Credits adjust: "2.9" and "1e3"
  await step('X9', async () => {
    const { ctx, page } = await adminPage()
    const carmen = await (async () => {
      await go(page, '#/admin/credits')
      return page.evaluate(async () => {
        const t = sessionStorage.getItem('ocr_admin_token')
        const r = await fetch('/api/v1/admin/tenants?limit=200', { headers: { Authorization: `Bearer ${t}` } })
        return ((await r.json()).data || []).find(x => x.bu_code === 'carmen')
      })
    })()
    await go(page, `#/admin/credits?tenant_id=${carmen.id}`)
    const amount = page.locator('input[type="number"]').first()
    await amount.waitFor({ timeout: 10000 })
    for (const [typed, want] of [['2.9', 'refused or 2.9'], ['1e3', 'refused or 1000']]) {
      await mark(amount, `X9 · type "${typed}" in the adjustment, press Apply`)
      await amount.fill('')
      await amount.type(typed)
      const adjusts = () => captured.filter(c => /credits\/adjust/.test(c.url))
      const n0 = adjusts().length
      await page.getByRole('button', { name: /Apply|Adjust/ }).first().click()
      const ok = page.getByRole('dialog').getByRole('button', { name: /Apply|Confirm|Yes/ }).last()
      if (await ok.isVisible({ timeout: 1000 }).catch(() => false)) await ok.click()
      await page.waitForTimeout(800)
      const delta = adjusts().length > n0 ? adjusts().at(-1).body?.delta : undefined // undefined = refused, nothing sent
      const right = delta === undefined || String(delta) === typed || (typed === '1e3' && delta === 1000)
      check(`X9${typed === '2.9' ? 'a' : 'b'}`, `Admin credit adjust: typing "${typed}" → ${want}`, right,
        delta === undefined ? 'nothing sent' : `sent delta ${JSON.stringify(delta)}`, 'generic')
    }
    await ctx.close()
  })

  // X5 — an On-Hold order's note, edited (the list answered with one on-hold order)
  await step('X5', async () => {
    const { ctx, page } = await adminPage()
    await ctx.route(/\/api\/v1\/admin\/credit-orders(\?|$)/, async route => {
      try {
        const res = await route.fetch()
        const j = await res.json()
        for (const o of j.data || []) Object.assign(o, { status: 'on_hold', admin_note: 'keep me: waiting for the buyer' })
        await route.fulfill({ response: res, json: j })
      } catch {
        await route.abort().catch(() => {}) // the context closed mid-request
      }
    })
    await go(page, '#/admin/credit-orders')
    const row = page.getByText('keep me', { exact: false }).first()
    const anyRow = page.locator('tbody tr').first()
    await (await row.isVisible().catch(() => false) ? row : anyRow).click()
    await page.getByRole('button', { name: 'Admin note (optional)' }).first().click()
    const box = page.locator('textarea').last()
    await mark(box, 'X5 · On Hold with note "keep me: waiting for the buyer" → press "Admin note" — what is in the box?')
    const shown = await box.inputValue()
    await page.getByRole('button', { name: 'Save note' }).click()
    await page.waitForTimeout(800)
    const sent = lastBody(/credit-orders\/[^/]+\/hold/)
    check('X5', 'Admin On-Hold order: editing the note starts from the note it has', shown.includes('keep me'),
      `note box opened with "${shown}", Save sent ${JSON.stringify(sent)}`, 'generic')
    await shot(page, 'X5-hold-note')
    await ctx.close()
  })

  // X11 — AR code: lower case with a space, and 16+ characters
  await step('X11', async () => {
    const { ctx, page } = await adminPage()
    await go(page, '#/admin/credit-orders')
    await page.getByRole('button', { name: /Customer Mapping/ }).click()
    await page.waitForTimeout(1500)
    const row = page.locator('tr', { has: page.locator('.orev-ar-act-cell') }).first()
    await row.locator('.orev-ar-act-cell button').first().click()
    const input = page.getByRole('textbox', { name: 'Carmen AR No.' }).first()
    await input.waitFor({ timeout: 5000 })
    await mark(input, 'X11a · type "ab", move left one, type "x" — does the caret stay?')
    await input.fill('')
    await input.type('ab', { delay: 30 })
    await input.press('ArrowLeft')
    await input.type('x', { delay: 30 })
    const caret = await input.evaluate(el => el.selectionStart)
    check('X11a', 'Admin AR code: typing in the middle keeps the caret there', caret === 2, `value "${await val(input)}", caret ${caret} (want 2)`, 'generic')
    await mark(input, 'X11b · AR code "ar 001 sweep test code" (space, 22 chars; API allows 15, A-Z 0-9 -) → Save')
    await input.fill('ar 001 sweep test code')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await page.waitForTimeout(2000)
    const t = (await toasts(page)).join(' | ')
    check('X11b', 'Admin AR code: "AR 001 SWEEP TEST CODE" (space, 22 chars) is refused with a reason', !/object Object/.test(t) && /15|character|letter|invalid|space/i.test(t),
      `typed into a maxLength ${await input.getAttribute('maxlength').catch(() => '?')} box · toast "${t.slice(0, 100)}"`, 'generic')
    await shot(page, 'X11-ar-code')
    await ctx.close()
  })

  // X18 — a pasted URL with limit=abc
  await step('X18', async () => {
    const { ctx, page } = await adminPage()
    const reqs = []
    page.on('request', r => /\/api\/v1\/admin\/llm/.test(r.url()) && reqs.push(r.url()))
    await go(page, '#/admin/llm-logs?limit=abc')
    await mark(page.locator('main h1, main h2').first(), 'X18 · opened from a pasted link with ?limit=abc')
    const rows = await page.locator('tbody tr').count()
    const lim = reqs.at(-1)?.match(/limit=([^&]*)/)?.[1]
    check('X18', 'Admin URL limit=abc falls back to a page size', lim && lim !== '0' && rows > 0, `request limit=${lim}, ${rows} rows`, 'code')
    await ctx.close()
  })
}

// ══ main ═════════════════════════════════════════════════════════════════════
const SECTION_FNS = {
  review: reviewSection,
  late: lateSection,
  pms: pmsSection,
  ap: apSection,
  manual: manualSection,
  mapping: mappingSection,
  email: emailSection,
  billing: billingSection,
  admin: adminSection,
}

async function main() {
  fs.mkdirSync(path.join(SHOTS, 'checks'), { recursive: true })
  if (EVIDENCE) {
    // last run's evidence only
    for (const d of ['checks', 'video'])
      for (const f of fs.existsSync(path.join(SHOTS, d)) ? fs.readdirSync(path.join(SHOTS, d)) : [])
        fs.rmSync(path.join(SHOTS, d, f), { force: true })
  }
  browser = await chromium.launch({
    headless: !HEADED,
    slowMo: SLOWMO,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  })
  for (const [name, fn] of Object.entries(SECTION_FNS)) {
    if (!want(name)) continue
    console.log(`\n── ${name} ─────────────────────────`)
    try {
      await fn()
    } catch (err) {
      check(`${name}`, `section crashed: ${String(err.message || err).split('\n')[0]}`, false, '', 'n/a')
    }
  }
  await browser.close()
}

await main()
if (reactWarnings.size)
  console.log(`\nReact warnings in the console:\n  ${[...reactWarnings].map(([k, v]) => `[${v}] ${k}`).join('\n  ')}`)
if (unexpected.length) console.log(`\nUNEXPECTED writes answered 599:\n  ${unexpected.join('\n  ')}`)
const bugs = results.filter(r => !r.ok)
console.log(`\n${results.length - bugs.length}/${results.length} OK, ${bugs.length} BUG`)
fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ results, captured, unexpected, reactWarnings: [...reactWarnings] }, null, 2))
if (EVIDENCE) writeReport()

// ── report.html: every check, where it was made, what it showed ───────────────
function writeReport() {
  const PAGES = {
    review: ['Credit card review (email queue)', '#/CreditCardOCR/review?id=… — JV amounts, Dept/Account pickers, input-tax Tax ID, Reject'],
    late: ['Late input-tax filing dialog', '#/CreditCardOCR → All → "Record input tax" — Vendor, Tax ID, Branch, Tax period'],
    pms: ['PMS day review', '#/CreditCardOCR/review?pms=… — Account picker, Reject reason'],
    ap: ['AP invoice wizard', '#/APInvoice — upload → field mapping → review table / From Document → GL mapping → post'],
    manual: ['Credit card manual wizard', '#/CreditCardOCR/manual — Details table amounts, Payment type, DocDate → input tax'],
    mapping: ['Mapping settings', '#/CreditCardOCR/mapping — Branch No, payment-type dialog search'],
    email: ['Email settings', '#/CreditCardOCR/email-settings — Company tax IDs, Rule PDF password'],
    billing: ['Checkout', '#/pricing → Choose plan — buyer name, Tax ID, email'],
    admin: ['Admin dashboard', '#/admin/* — Period, date range, table search & pager, reset password, login, credit adjust, hold note, AR code, URL limit'],
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const rel = f => (f ? path.relative(SHOTS, f).split(path.sep).join('/') : null)
  const bugs = results.filter(r => !r.ok)
  const sections = [...new Set(results.map(r => r.section))]
  const body = sections
    .map(sec => {
      const rows = results.filter(r => r.section === sec)
      const [title, where] = PAGES[sec] || [sec, '']
      return `<section><h2>${esc(title)} <small>${rows.filter(r => !r.ok).length} bug / ${rows.length} checks</small></h2>
<p class="where">${esc(where)}</p>
${rows
  .map(
    r => `<article class="${r.ok ? 'ok' : 'bug'}">
  <header><span class="badge">${r.ok ? 'OK' : 'BUG'}</span> <b>${esc(r.id)}</b> ${esc(r.name)}
  <span class="how">${r.how === 'generic' ? 'generic edge case' : r.how === 'code' ? 'pointed at by the code' : ''}</span></header>
  ${r.detail ? `<p class="detail">${esc(r.detail)}</p>` : ''}
  <div class="media">${r.shot ? `<a href="${esc(r.shot)}" target="_blank"><img loading="lazy" src="${esc(r.shot)}"></a>` : ''}
  ${r.video ? `<a class="vid" href="${esc(rel(r.video))}" target="_blank">▶ video of this context</a>` : ''}</div>
</article>`
  )
  .join('\n')}
</section>`
    })
    .join('\n')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Input sweep — ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
main{max-width:1180px;margin:0 auto;padding:24px}
h1{margin:0 0 4px}h2{margin:32px 0 2px;font-size:20px}h2 small{font-weight:500;color:#64748b;font-size:14px}
.where{margin:0 0 12px;color:#475569;font-family:ui-monospace,monospace;font-size:12.5px}
article{background:#fff;border:1px solid #e2e8f0;border-left:5px solid #16a34a;border-radius:8px;padding:10px 14px;margin:10px 0}
article.bug{border-left-color:#dc2626}
.badge{display:inline-block;min-width:34px;text-align:center;border-radius:4px;color:#fff;background:#16a34a;font-weight:700;font-size:12px;padding:1px 6px}
.bug .badge{background:#dc2626}.how{float:right;color:#64748b;font-size:12px}
.detail{margin:6px 0;font-family:ui-monospace,monospace;font-size:12.5px;color:#334155;white-space:pre-wrap}
.media img{max-width:100%;border:1px solid #e2e8f0;border-radius:6px;margin-top:6px}
.vid{display:inline-block;margin-top:6px}
.sum{display:flex;gap:16px;margin:12px 0}.sum div{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px}
.sum b{font-size:22px;display:block}
</style></head><body><main>
<h1>Input-field sweep</h1>
<p>Every page's inputs typed key by key in a real browser (backend :8011, dev DB). The field under test is outlined in red; the strip at the bottom says what was done and what came of it. Writes were answered in the browser; the only requests let through were ones the API refuses with a 422 before its handler runs.</p>
<div class="sum"><div><b>${results.length}</b>checks</div><div><b style="color:#dc2626">${bugs.length}</b>reproduced bugs</div><div><b style="color:#16a34a">${results.length - bugs.length}</b>behave right</div><div><b>${sections.length}</b>areas</div></div>
${body}
${unexpected.length ? `<h2>Unexpected writes (answered 599)</h2><pre>${esc(unexpected.join('\n'))}</pre>` : ''}
${reactWarnings.size ? `<h2>React warnings in the console</h2><pre>${esc([...reactWarnings].map(([k, v]) => `[${v}] ${k}`).join('\n'))}</pre>` : ''}
</main></body></html>`
  fs.writeFileSync(path.join(SHOTS, 'report.html'), html)
  console.log(`report: ${path.join(SHOTS, 'report.html')}`)
}
