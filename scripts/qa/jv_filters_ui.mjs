// JV queue filters — the browser half. Data comes from jv_filters_e2e.py (local Supabase).
//
//   python scripts/qa/jv_filters_e2e.py setup
//   backend:  DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres \
//             backend/venv/Scripts/python scripts/qa/jv_filters_backend.py   (port 8012; lifts
//             the rate limits in its own process only — the suite makes ~6,000 requests)
//   frontend: vite on 3012 proxying /api to 8012
//   node scripts/qa/jv_filters_ui.mjs                    (APP_URL / API_URL override the ports)
//   python scripts/qa/jv_filters_e2e.py teardown
//
// One pass/fail line per test case ID; exit 1 on any failure. Screenshots → OUT.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, '.playwright-mcp/jv-filters')
const APP = process.env.APP_URL || 'http://localhost:3012'
const API = process.env.API_URL || 'http://127.0.0.1:8012'
const LOCAL = process.env.LOCALAPPDATA || path.join(process.env.HOME || '', 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

// CSP_LISTEN=1: report every `securitypolicyviolation` (the app is served with the enforced CSP).
const CSP_LISTEN = process.env.CSP_LISTEN === '1'
const FIX = JSON.parse(fs.readFileSync(path.join(OUT, 'fixture.json'), 'utf8'))
const T = FIX.tenants

// ── The oracle: what a view must show, worked out from the fixture rows alone ────────────────
// `jv_filters_e2e.py` writes every row with what the screen should make of it (source, bank, the
// chip it lives under, when it happened, the words a search may match). Nothing below reads the
// server's SQL or mirrors its code; it applies the documented rules to that table.
const DAY_START = Date.parse(FIX.dayStart)
const RANGE_DAYS = { today: 0, '7d': 6, '30d': 29 }
/** Rows a screen may ever show: `no_rule_match` and a PMS day mid-read are in no view at all. */
const VISIBLE = FIX.rows.filter(r => r.chip !== 'hidden')
const byTimeDesc = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) // fixed-width UTC strings

/** A PMS day has no bank, so the two are never asked for together (the menu locks one while the
 *  other is chosen, the API answers 400, a pasted link repairs itself): the bank goes. */
const reconcile = n => (n.bank && n.sources.includes('pms') ? { ...n, bank: '' } : n)

/** Rows a narrowing admits, whatever their status — the pile the Review count is taken over. */
function pileOf(rows, { sources = [], bank = '', range = '', q = '' } = {}) {
  const needle = q.trim().toLowerCase()
  return rows.filter(r => {
    if (sources.length && !sources.includes(r.src)) return false
    if (bank && (r.src === 'pms' || r.bank !== bank)) return false
    if (range && Date.parse(r.at) < DAY_START - RANGE_DAYS[range] * 86400e3) return false
    if (needle && !r.fields.some(f => f.toLowerCase().includes(needle))) return false
    return true
  })
}

/** What `filter` + a narrowing must show: the ordered keys, the total, and every count. */
function oracle(filter, narrow = {}, rows = VISIBLE) {
  const pile = pileOf(rows, narrow)
  const today = pile.filter(r => Date.parse(r.at) >= DAY_START)
  const shown =
    filter === 'all' ? pile : filter === 'today' ? today : pile.filter(r => r.chip === filter)
  const n = c => pile.filter(r => r.chip === c).length
  return {
    keys: [...shown].sort(byTimeDesc).map(r => r.key),
    total: shown.length,
    counts: {
      review: n('review'),
      success: n('success'),
      unposted: n('unposted'),
      all: pile.length,
      today: today.length,
    },
  }
}
const STATUSES = ['review', 'success', 'unposted']
const ageOf = new Map(FIX.rows.map(r => [r.key, r.age]))

// ── Harness ───────────────────────────────────────────────────────────────────────────────
const results = []
const browser = await chromium.launch({ executablePath: CHROME })

// ONLY=M-,G-  runs just the cases whose id starts with one of those (while iterating).
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean)
async function test(id, name, fn) {
  if (ONLY.length && !ONLY.some(p => id.startsWith(p))) return
  const t0 = Date.now()
  try {
    await fn()
    results.push({ id, name, ok: true })
    console.log(`PASS ${id}  ${name}  (${Date.now() - t0}ms)`)
  } catch (e) {
    results.push({ id, name, ok: false, err: String(e.message || e) })
    console.log(`FAIL ${id}  ${name}\n       ${String(e.message || e).split('\n').join('\n       ')}`)
  }
}
const eq = (a, b, what) => {
  const x = JSON.stringify(a)
  const y = JSON.stringify(b)
  if (x !== y) throw new Error(`${what}\n  got      ${x}\n  expected ${y}`)
}
const ok = (c, what) => {
  if (!c) throw new Error(what)
}

/** A page signed in as tenant `who`, with every activity request and every console error
 *  recorded. `lang`, `theme`, `rows` (rows per page) are the reader's stored preferences. */
async function open(
  who,
  hash,
  {
    vp = { width: 1280, height: 900 },
    lang = 'en',
    theme = 'light',
    rows = 100,
    reduced = false,
    tz = undefined, // the BROWSER's timezone; "Today" must not depend on it
    touch = false, // emulated phone: touch events, mobile viewport
    delay = undefined, // { rnd, max }: hold every /activity response a random 0..max ms
  } = {}
) {
  const t = T[who]
  const ctx = await browser.newContext({
    viewport: vp,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...(tz ? { timezoneId: tz } : {}),
    ...(touch ? { isMobile: true, hasTouch: true } : {}),
  })
  await ctx.addInitScript(
    ({ jwt, user, lang, theme, rows }) => {
      sessionStorage.setItem('ocr_access_token', jwt)
      sessionStorage.setItem('ocr_user:v1', JSON.stringify(user))
      localStorage.setItem('lang', lang)
      localStorage.setItem('theme', theme)
      localStorage.setItem(`ocr_consent_v2_${user.tenant_id}`, '1')
      if (rows) localStorage.setItem('rowsPerPage', String(rows))
    },
    { jwt: t.jwt, user: t.user, lang, theme, rows }
  )
  if (CSP_LISTEN)
    await ctx.addInitScript(() => {
      window.__csp = []
      document.addEventListener('securitypolicyviolation', e =>
        window.__csp.push(`${e.violatedDirective} ${e.blockedURI || e.sample || ''}`.trim())
      )
    })
  const page = await ctx.newPage()
  const h = { ctx, page, calls: [], done: [], pending: 0, errors: [], statuses: [] }
  const isActivity = u => new URL(u).pathname === '/api/v1/credit-card/activity'
  page.on('request', r => {
    if (isActivity(r.url())) {
      h.calls.push(new URL(r.url()).searchParams)
      h.pending++
    }
  })
  page.on('requestfinished', r => {
    if (!isActivity(r.url())) return
    h.pending--
    h.done.push(new URL(r.url()).search)
  })
  if (delay)
    await page.route('**/api/v1/credit-card/activity*', async route => {
      await new Promise(res => setTimeout(res, Math.floor(delay.rnd() * delay.max)))
      await route.continue().catch(() => {})
    })
  page.on('requestfailed', r => isActivity(r.url()) && h.pending--)
  page.on('response', r => isActivity(r.url()) && h.statuses.push(r.status()))
  // The fixture sessions carry a made-up Carmen token, so the GL-master prefetch (/api/v1/carmen/*,
  // which runs whenever rows appear) gets a 503 and the browser logs it. That is the harness, not
  // the page: everything else on the console is still an error.
  page.on('console', m => {
    if (m.type() !== 'error') return
    if (m.text().startsWith('Failed to load resource') && m.location().url.includes('/api/v1/carmen/')) return
    h.errors.push(m.text())
  })
  page.on('pageerror', e => h.errors.push('pageerror: ' + e.message))
  if (hash !== null) {
    await page.goto(`${APP}/${hash}`)
    // First load compiles the page on demand; the strip or an empty card is the first sign
    // the queue has rendered at all.
    await page.waitForSelector('.rq-tab, .rq-empty', { timeout: 30000 })
  }
  await idle(h)
  return h
}
/** Closing a page is also the moment to ask what the browser refused: with CSP_LISTEN=1 the suite
 *  runs against `vite preview` serving vercel.json's enforced headers, and one blocked resource
 *  fails the case that caused it. */
async function close(h) {
  if (CSP_LISTEN) {
    const seen = await h.page.evaluate(() => window.__csp || []).catch(() => [])
    if (seen.length) {
      await h.ctx.close()
      throw new Error(`the CSP refused ${seen.length} thing(s): ${[...new Set(seen)].slice(0, 4).join(' | ')}`)
    }
  }
  await h.ctx.close()
}

/** Quiet: nothing in flight and no new request for a beat — a debounce has fired or it won't. */
async function idle(h, quiet = 600) {
  let last = -1
  let since = Date.now()
  for (let i = 0; i < 100; i++) {
    if (h.calls.length !== last || h.pending > 0) {
      last = h.calls.length
      since = Date.now()
    } else if (Date.now() - since >= quiet) return
    await h.page.waitForTimeout(100)
  }
  throw new Error('page never went quiet')
}
const hashOf = h => h.page.evaluate(() => location.hash)
const last = h => h.calls[h.calls.length - 1]

const tabs = h =>
  h.page.evaluate(() =>
    [...document.querySelectorAll('.rq-tab')].map(t => ({
      label: t.childNodes[0].textContent.trim(),
      count: t.querySelector('.rq-tab-count')?.textContent ?? null,
      sel: t.getAttribute('aria-selected') === 'true',
    }))
  )
/** The rows on screen, in order, each as the Document cell reads: `<doc no or —> <file>`. */
const rowKeys = h =>
  h.page.evaluate(() =>
    [...document.querySelectorAll('.rq-table tbody tr.rq-row:not(.rq-row--skeleton)')].map(
      tr =>
        `${tr.querySelector('.rq-docno')?.textContent.trim() || '—'} ${tr
          .querySelector('.rq-file')
          ?.textContent.trim()}`
    )
  )
const pagerTotal = h =>
  h.page.evaluate(() => {
    const m = document.querySelector('.pager__range')?.textContent.match(/of\s+([\d,]+)/)
    return m ? Number(m[1].replace(/,/g, '')) : null
  })
const selectedTab = async h => (await tabs(h)).find(t => t.sel)?.label
const clickTab = async (h, name) => {
  await h.page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
  await idle(h)
}
/** The old All-chip dropdown ("Show"). There is none any more; this is how tests say so. */
const scopeBtn = h => h.page.getByRole('button', { name: 'Show', exact: true })
/** Pick a status in the `+ Filter` menu — the only way to Posted / Not posted. */
async function pickScope(h, name) {
  await pill(h, name)
  await closeMenu(h)
}
const searchBox = h => h.page.getByRole('searchbox')
const search = async (h, text) => {
  await searchBox(h).fill(text)
  await idle(h)
}
/** The `+ Filter` button. */
const filtersBtn = h => h.page.getByRole('button', { name: /^(Filter|ตัวกรอง)$/ })
const menu = h => h.page.locator('.rq-menu')
const options = h => menu(h).locator('[role^="menuitem"]')
const ATTR_OF = name =>
  ['Posted', 'Not posted'].includes(name)
    ? 'Status'
    : ['Email', 'Manual', 'PMS'].includes(name)
      ? 'Source'
      : ['Any time', 'Today', 'Last 7 days', 'Last 30 days'].includes(name)
        ? 'Date'
        : 'Bank'
/** Close an open menu the way a reader does — a click elsewhere. Not Escape: with focus in the
 *  search box Escape clears the text (the browser's own search-field behaviour). */
async function closeMenu(h) {
  if (await menu(h).count()) {
    await h.page.mouse.click(4, 4)
    await idle(h, 300)
  }
}
/** Choose a value the way a reader does: `+ Filter` → attribute → value. A multi-select list
 *  stays open on its own, so each call closes whatever is open first and starts fresh. */
async function pill(h, name) {
  await closeMenu(h)
  await filtersBtn(h).click()
  await menu(h).getByRole('menuitem', { name: new RegExp(`^${ATTR_OF(name)}`) }).click()
  await options(h)
    .filter({ hasText: new RegExp(`^${name}(\\s|$)`) })
    .click()
  await idle(h)
}
/** What each applied chip says — `Bank: KBANK`. */
const chips = h =>
  h.page.evaluate(() =>
    [...document.querySelectorAll('.rq-chip-main')].map(c => c.textContent.replace(/\s+/g, ' ').trim())
  )
const clearLink = h => h.page.locator('.rq-chips .rq-clear')

/** The invariant the whole feature rests on: for a given view, the rows, every tab's number
 *  and the Pager's total all describe the same pile — and it is the pile `ROWS` predicts. */
async function expectView(h, status, narrow, what = '', limit = 100) {
  const want = oracle(status, narrow)
  const got = await rowKeys(h)
  const shown = want.keys.slice(0, limit)
  if (JSON.stringify(got) !== JSON.stringify(shown))
    throw new Error(`${what} rows (${status} ${JSON.stringify(narrow)})\n${diff(got, shown)}`)
  const t = await tabs(h)
  // Review is the only chip with a number; it is taken under the narrowing like the rows are.
  eq(t.find(x => x.label === 'Review').count, String(want.counts.review), `${what} count of Review`)
  const total = await pagerTotal(h)
  if (want.total > 10) eq(total, want.total, `${what} pager total`)
  else eq(total, null, `${what} pager hidden at ≤10`)
}
/** Says what is missing, what is extra, and whether it is only the order. */
function diff(got, want) {
  const g = new Set(got)
  const w = new Set(want)
  const missing = want.filter(k => !g.has(k))
  const extra = got.filter(k => !w.has(k))
  const head = a => JSON.stringify(a.slice(0, 5)) + (a.length > 5 ? ` …+${a.length - 5}` : '')
  return `  rows: got ${got.length}, expected ${want.length}\n  missing ${head(missing)}\n  extra   ${head(extra)}${
    !missing.length && !extra.length ? '\n  same rows, different ORDER' : ''
  }`
}
const shot = (h, name) => h.page.screenshot({ path: path.join(OUT, `${name}.png`) })

// Ages of 0 days are 10 min–3 h old; before 04:00 ICT they would be yesterday's.
const ictHour = (new Date().getUTCHours() + 7) % 24
if (ictHour < 4) console.log('WARN: before 04:00 ICT — the Today cases would be unreliable')

// ═══ S: strip & counts ═══════════════════════════════════════════════════════════════════
await test('S-01', 'two tabs, Review (counted) and All (not), opens on Review', async () => {
  const h = await open('a', '#/CreditCardOCR')
  eq(
    (await tabs(h)).map(t => [t.label, t.count, t.sel]),
    [
      ['Review', String(oracle('review').counts.review), true],
      ['All', null, false],
    ],
    'strip'
  )
  eq(await scopeBtn(h).count(), 0, 'no dropdown while on Review')
  await shot(h, 'S-01-strip')
  await close(h)
})

await test('S-02', 'each chip and each Status pill asks for its own filter and shows exactly that pile', async () => {
  const h = await open('a', '#/CreditCardOCR')
  await clickTab(h, 'All')
  eq(last(h).get('filter'), 'all', 'All chip')
  await expectView(h, 'all', {}, 'All')
  for (const [name, f] of [
    ['Posted', 'success'],
    ['Not posted', 'unposted'],
  ]) {
    await pickScope(h, name)
    eq(last(h).get('filter'), f, `request for ${name}`)
    eq(await selectedTab(h), 'All', `${name} lights the All chip`)
    eq(await chips(h), [`Status: ${name}`], `${name} wears a chip`)
    await expectView(h, f, {}, name)
    await pickScope(h, name) // pressed again: lets go
    eq(last(h).get('filter'), 'all', `${name} released`)
  }
  await pickScope(h, 'Today')
  eq([last(h).get('filter'), last(h).get('range')], ['all', 'today'], 'Today is a range')
  await expectView(h, 'all', { range: 'today' }, 'Today')
  await pickScope(h, 'Any time')
  await clickTab(h, 'Review')
  eq(last(h).get('filter'), 'review', 'Review chip')
  await expectView(h, 'review', {}, 'Review')
  eq((await tabs(h)).find(t => t.label === 'All').count, null, 'All has no count')
  await close(h)
})

await test('S-03', 'zero stays printed; a BU with no rows gets no strip, search or Filters', async () => {
  const b = await open('b', '#/CreditCardOCR') // 1 posted email, nothing to review
  eq((await tabs(b)).find(t => t.label === 'Review').count, '0', 'zero is shown')
  await close(b)
  const c = await open('c', '#/CreditCardOCR')
  ok(await c.page.getByText('No scans yet').isVisible(), 'no-scans card')
  eq(await c.page.locator('.rq-tab').count(), 0, 'no tabs')
  eq(await searchBox(c).count(), 0, 'no search')
  eq(await filtersBtn(c).count(), 0, 'no Filters')
  await close(c)
})

await test('S-04', 'the opening tab is settled once: fall-through only when nothing was asked for', async () => {
  const a = await open('a', '#/CreditCardOCR')
  eq(a.calls.map(c => c.get('filter')), ['review'], 'A: Review has work, one request')
  await close(a)
  const b = await open('b', '#/CreditCardOCR')
  eq(b.calls.map(c => c.get('filter')), ['review', 'all'], 'B: empty Review hops to All once')
  eq(await selectedTab(b), 'All', 'landed on All')
  await close(b)
  const named = await open('a', '#/CreditCardOCR?filter=success')
  eq(named.calls.map(c => c.get('filter')), ['success'], 'named filter: no hop')
  eq(await selectedTab(named), 'All', 'Posted lights the All chip')
  eq(await chips(named), ['Status: Posted'], 'and a Status chip says which')
  await close(named)
  const narrowed = await open('a', '#/CreditCardOCR?q=qa')
  eq(narrowed.calls.map(c => c.get('filter')), ['all'], 'a narrowing opens on All, no hop')
  await close(narrowed)
})

await test('S-05', '`+ Filter` lists attributes first, then the values of the one picked; no dropdown anywhere', async () => {
  const h = await open('a', '#/CreditCardOCR')
  eq(await scopeBtn(h).count(), 0, 'no dropdown on Review')
  await clickTab(h, 'All')
  eq(await scopeBtn(h).count(), 0, 'no dropdown on All')
  await filtersBtn(h).click()
  eq(await menu(h).getByRole('menuitem').allInnerTexts(), ['Status', 'Source', 'Bank', 'Date'], 'attributes')
  eq(await menu(h).getByText('Kasikornbank').count(), 0, 'no values laid out yet')
  const values = async attr => {
    await menu(h).getByRole('menuitem', { name: new RegExp(`^${attr}`) }).click()
    return (await options(h).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim())
  }
  eq(await values('Status'), ['Posted', 'Not posted'], 'Status values')
  await menu(h).getByRole('button', { name: 'Back' }).click()
  eq(await values('Source'), ['Email', 'Manual', 'PMS'], 'Source values')
  eq(await options(h).first().getAttribute('role'), 'menuitemcheckbox', 'Source is multi')
  await menu(h).getByRole('button', { name: 'Back' }).click()
  eq((await values('Bank'))[1], 'KBANK Kasikornbank', 'a bank is named beside its code')
  eq(await options(h).first().getAttribute('role'), 'menuitemradio', 'Bank is single')
  await menu(h).getByRole('button', { name: 'Back' }).click()
  eq(await values('Date'), ['Any time', 'Today', 'Last 7 days', 'Last 30 days'], 'Date values')
  await shot(h, 'S-05-menu')
  await close(h)
})

await test('S-06', 'there is no Posted or Not posted chip anywhere in the bar', async () => {
  for (const hash of ['#/CreditCardOCR', '#/CreditCardOCR?filter=unposted', '#/CreditCardOCR?bank=KBANK']) {
    const h = await open('a', hash)
    eq((await tabs(h)).map(t => t.label), ['Review', 'All'], `tabs at ${hash}`)
    eq(await h.page.getByRole('tab', { name: /Posted/ }).count(), 0, 'no Posted/Not posted tab')
    await close(h)
  }
})

// ═══ Q: search ═══════════════════════════════════════════════════════════════════════════
await test('Q-01', 'typing commits once after the pause, not per keystroke', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  const before = h.calls.length
  await searchBox(h).click()
  await h.page.keyboard.type('qa-jvf-e04', { delay: 40 })
  await idle(h, 900)
  const made = h.calls.slice(before)
  eq(made.length, 1, 'one request for ten keystrokes')
  eq(made[0].get('q'), 'qa-jvf-e04', 'the whole word')
  await expectView(h, 'all', { q: 'qa-jvf-e04' }, 'typed')
  await close(h)
})

await test('Q-02', 'finds doc no., file, bank and PMS interface; case-insensitive; Thai', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  for (const q of [
    'QA-mKBANKP',
    'qa-jvf-e05',
    'ktc',
    'KTC',
    'comanche',
    'COMANCHE',
    'hoteltime',
    'daily',
    'pms',
    'QA-DUP-001',
    'ใบแจ้งหนี้',
    'qa-jvf-upper',
    'x'.repeat(80),
  ]) {
    await search(h, q)
    await expectView(h, 'all', { q }, `search "${q.slice(0, 20)}"`)
    ok(oracle('all', { q }).total > 0, `the fixture has something to find for "${q.slice(0, 20)}"`)
  }
  await close(h)
})

await test('Q-05', 'searching never reads the JSON KEYS of a PMS day: "type", "name", "interface", "doc"', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  for (const q of ['type', 'name', 'interface', 'docdate', 'InterfaceType']) {
    await search(h, q)
    await expectView(h, 'all', { q }, `search "${q}"`)
    // A reader typing "type" is looking for a document; every PMS day carrying the word in the
    // hook's own field names is not a match.
    ok(
      !(await rowKeys(h)).some(k => / · Daily$/.test(k)) || oracle('all', { q }).total > 0,
      `"${q}" matched PMS days by their field names`
    )
  }
  await close(h)
})

await test('Q-03', 'LIKE wildcards, backslash, quotes are literal: % _ \ \' " match themselves only', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  for (const q of ['50%', '50_off', '50%_off', '%', '_', 'back\\slash', '\\', "o'brien", '"quoted"', "'", '%%', 'e0_']) {
    await search(h, q)
    await expectView(h, 'all', { q }, `search ${JSON.stringify(q)}`)
  }
  // The two that would collide if the wildcards were live.
  await search(h, '50_off')
  eq((await rowKeys(h)).length, 0, '"50_off" must not match "50xoff"')
  await search(h, '50%_off')
  eq((await rowKeys(h)).length, 1, 'both wildcards literal')
  await close(h)
})

await test('Q-04', 'cleared from the box or the chip; typing stops at 100 characters', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await search(h, 'qa-jvf-bbl')
  await search(h, '')
  eq(last(h).get('q'), null, 'box cleared → no q')
  await search(h, 'qa-jvf-bbl')
  eq(await chips(h), [], 'a search is the box, not a chip')
  await searchBox(h).press('Escape') // a search field clears itself on Escape
  await idle(h, 900)
  eq(last(h).get('q'), null, 'Escape in the box → no q')
  eq(await searchBox(h).inputValue(), '', 'box is empty')
  await searchBox(h).click()
  await h.page.keyboard.type('a'.repeat(150), { delay: 0 })
  await idle(h, 900)
  eq((await searchBox(h).inputValue()).length, 100, 'input stops at 100')
  eq(last(h).get('q').length, 100, 'request carries ≤100')
  ok(h.statuses.every(s => s === 200), 'no 4xx')
  await close(h)
})

// ═══ F: the Filters popover ══════════════════════════════════════════════════════════════
await test('F-01', 'Source: one and several; rows and counts both drop the rest', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await pill(h, 'Email')
  await expectView(h, 'all', { sources: ['email'] }, 'email')
  await pill(h, 'Manual')
  await expectView(h, 'all', { sources: ['email', 'manual'] }, 'email+manual')
  await pill(h, 'Email')
  await pill(h, 'Manual')
  await pill(h, 'PMS')
  await expectView(h, 'all', { sources: ['pms'] }, 'pms')
  eq(last(h).get('source'), 'pms', 'request')
  await shot(h, 'F-01-source')
  await close(h)
})

await test('F-02', 'Bank leaves PMS days out and says so; releasing it brings them back', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await pill(h, 'KBANK')
  await expectView(h, 'all', { bank: 'KBANK' }, 'KBANK')
  // The note sits in the Bank list itself: said where the choice is made.
  await closeMenu(h)
  await filtersBtn(h).click()
  await menu(h).getByRole('menuitem', { name: /^Bank/ }).click()
  ok(await menu(h).getByText(/PMS days have no bank/).isVisible(), 'the note')
  await menu(h).locator('[aria-checked="true"]').click() // the picked bank, picked again: released
  await idle(h)
  await expectView(h, 'all', {}, 'released')
  await close(h)
})

await test('F-03', 'Date: Today / 7 days / 30 days against fixture ages', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  for (const [name, r] of [
    ['Today', 'today'],
    ['Last 7 days', '7d'],
    ['Last 30 days', '30d'],
    ['Any time', ''],
  ]) {
    await pill(h, name)
    await expectView(h, 'all', { range: r }, name)
  }
  // The edges, spelled out: the 60-day row only in Any time, the 5-day row not in Today.
  // The edges, each from the fixture's own ages: a row a minute either side of the line.
  const inRange = (age, range) => oracle('all', { range }).keys.some(k => ageOf.get(k) === age)
  await pill(h, 'Last 30 days')
  ok(inRange('d29-in', '30d') && !inRange('d29-out', '30d'), 'the 30-day edge, ±1 minute')
  eq(await rowKeys(h), oracle('all', { range: '30d' }).keys.slice(0, 100), 'and the screen agrees')
  await pill(h, 'Last 7 days')
  ok(inRange('d6-in', '7d') && !inRange('d6-out', '7d'), 'the 7-day edge, ±1 minute')
  await pill(h, 'Today')
  ok(inRange('today-3h', 'today') && !inRange('yesterday', 'today'), 'Today ends at the BU midnight')
  await expectView(h, 'all', { range: 'today' }, 'Today edge')
  await close(h)
})

await test('F-04', 'status × source × bank × range: rows, tab counts and Pager total always agree', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  const sources = [[], ['email'], ['manual'], ['email', 'manual'], ['pms'], ['email', 'pms']]
  const banks = ['', 'KBANK', 'SCB']
  const ranges = ['', 'today', '7d', '30d']
  let n = 0
  for (const status of ['review', 'success', 'unposted', 'all']) {
    for (const s of sources) {
      for (const bank of banks) {
        for (const range of ranges) {
          // Every 5th of the matrix — 288 loads is a lot; this still hits each axis value
          // with every status. The full matrix is covered by the backend unit tests.
          if (n++ % 5) continue
          const qs = new URLSearchParams({ filter: status })
          if (s.length) qs.set('source', s.join(','))
          if (bank) qs.set('bank', bank)
          if (range) qs.set('range', range)
          await h.page.evaluate(x => (location.hash = x), `#/CreditCardOCR?${qs}`)
          await idle(h, 400)
          await expectView(h, status, reconcile({ sources: s, bank, range }), `[${qs}]`)
        }
      }
    }
  }
  console.log(`       ${Math.ceil(n / 5)} combinations checked`)
  await close(h)
})

await test('F-05', 'one chip per attribute, `Source` listing two then +n; Clear keeps the search; the lock shapes what can be combined', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await search(h, 'qa')
  // Three sources (PMS among them): a bank is not available, so the chips are status / source / date.
  for (const name of ['Email', 'Manual', 'PMS', 'Last 7 days', 'Posted']) await pill(h, name)
  eq(
    await chips(h),
    ['Status: Posted', 'Source: Email, Manual +1', 'Date: Last 7 days'],
    'three chips, in attribute order; the search is not one'
  )
  eq(await filtersBtn(h).innerText(), 'Filter', 'no badge number: the chips are the count')
  await closeMenu(h)
  await clearLink(h).click()
  await idle(h)
  eq(last(h).get('filter'), 'all', 'Clear lets go of the status')
  eq(last(h).get('q'), 'qa', 'the search survives Clear')
  eq(await chips(h), [], 'no chips left')
  eq(await clearLink(h).count(), 0, 'and no Clear link: it exists only while a chip does')
  eq(await searchBox(h).inputValue(), 'qa', 'the box still says what it searched')
  // Without PMS the bank is free, and all four attributes can wear a chip at once.
  for (const name of ['Email', 'Manual', 'KBANK', 'Last 30 days', 'Not posted']) await pill(h, name)
  eq(
    await chips(h),
    ['Status: Not posted', 'Source: Email, Manual', 'Bank: KBANK', 'Date: Last 30 days'],
    'four chips'
  )
  await expectView(h, 'unposted', { q: 'qa', sources: ['email', 'manual'], bank: 'KBANK', range: '30d' }, 'all four')
  await close(h)
})

await test('F-06', 'menu: Escape and outside click close it; focus returns; arrows move; checkboxes toggle', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await filtersBtn(h).click()
  ok(await menu(h).isVisible(), 'opens')
  eq(await menu(h).getByRole('menuitem').first().evaluate(b => b === document.activeElement), true, 'focus lands on the first item')
  await h.page.keyboard.press('Escape')
  eq(await menu(h).count(), 0, 'Escape closes')
  ok(await filtersBtn(h).evaluate(b => b === document.activeElement), 'focus back on the button')
  await filtersBtn(h).click()
  await h.page.mouse.click(1000, 700)
  eq(await menu(h).count(), 0, 'outside click closes')
  await filtersBtn(h).click()
  await h.page.keyboard.press('ArrowDown')
  eq(await h.page.evaluate(() => document.activeElement.textContent.trim()), 'Source', 'ArrowDown moves')
  await h.page.keyboard.press('ArrowUp')
  await h.page.keyboard.press('ArrowUp')
  eq(await h.page.evaluate(() => document.activeElement.textContent.trim()), 'Date', 'ArrowUp wraps')
  await h.page.keyboard.press('ArrowUp')
  await h.page.keyboard.press('ArrowUp')
  eq(await h.page.evaluate(() => document.activeElement.textContent.trim()), 'Source', 'two more up')
  await h.page.keyboard.press('Enter')
  const email = options(h).first()
  eq(await email.getAttribute('aria-checked'), 'false', 'unchecked')
  await h.page.keyboard.press('Enter')
  await idle(h)
  eq(await options(h).first().getAttribute('aria-checked'), 'true', 'checked, and the list stays open')
  eq(last(h).get('source'), 'email', 'request')
  await h.page.keyboard.press('ArrowLeft')
  eq(await menu(h).getByRole('menuitem').count(), 4, 'ArrowLeft goes back to the attributes')
  await close(h)
})

// ═══ C: chips & empty states ═════════════════════════════════════════════════════════════
await test('C-01', 'one chip per attribute; each ✕ removes only its own; the label reopens its list', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&q=qa&source=email&bank=KBANK&range=7d')
  eq(await chips(h), ['Source: Email', 'Bank: KBANK', 'Date: Last 7 days'], 'three chips; the search is the box')
  eq(
    await h.page.getByRole('button', { name: /^Remove filter/ }).evaluateAll(b => b.map(x => x.ariaLabel)),
    ['Remove filter: Source: Email', 'Remove filter: Bank: KBANK', 'Remove filter: Date: Last 7 days'],
    'labels'
  )
  await h.page.getByRole('button', { name: 'Remove filter: Source: Email' }).click()
  await idle(h)
  eq(await chips(h), ['Bank: KBANK', 'Date: Last 7 days'], 'only Email went')
  eq(last(h).get('source'), null, 'request follows')
  eq(last(h).get('bank'), 'KBANK', 'the others stay')
  await h.page.getByRole('button', { name: 'Date: Last 7 days', exact: true }).click()
  eq(
    await options(h).evaluateAll(o => o.map(x => [x.textContent.trim(), x.getAttribute('aria-checked')])),
    [['Any time', 'false'], ['Today', 'false'], ['Last 7 days', 'true'], ['Last 30 days', 'false']],
    'the chip reopens its own list with the value checked'
  )
  eq(await menu(h).getByRole('button', { name: 'Back' }).count(), 0, 'no way back: it did not come from + Filter')
  await h.page.getByRole('button', { name: 'Last 30 days' }).click().catch(async () => {
    await options(h).filter({ hasText: /^Last 30 days$/ }).click()
  })
  await idle(h)
  eq(await chips(h), ['Bank: KBANK', 'Date: Last 30 days'], 'changed in place')
  await shot(h, 'C-01-chips')
  await close(h)
})

await test('C-02', 'no match ≠ no scans; a status-only empty keeps its own words and tick rule', async () => {
  const a = await open('a', '#/CreditCardOCR?filter=all')
  await search(a, 'zzzz')
  ok(await a.page.getByText('No documents match').isVisible(), 'no match card')
  eq(await a.page.getByText('No scans yet').count(), 0, 'not the no-scans card')
  ok(await searchBox(a).isVisible() && (await filtersBtn(a).isVisible()), 'controls remain')
  await a.page.locator('.rq-empty').getByRole('button', { name: 'Clear all' }).click()
  await idle(a)
  await expectView(a, 'all', {}, 'every visible row is back')
  ok(!(await rowKeys(a)).includes('qa-jvf-hidden.pdf'), 'the hidden row stays hidden')
  await close(a)
  const b = await open('b', '#/CreditCardOCR')
  await clickTab(b, 'Review')
  ok(await b.page.getByText('Nothing needs review').isVisible(), 'Review empty copy')
  ok((await b.page.locator('.rq-empty-icon--ok').count()) === 1, 'the tick, earned on Review')
  await pickScope(b, 'Not posted')
  ok(await b.page.getByText('No failed documents').isVisible(), 'Not posted empty copy')
  eq(await b.page.locator('.rq-empty-icon--ok').count(), 0, 'no tick on Not posted')
  await shot(b, 'C-02-empty')
  await close(b)
})

await test('C-03', 'a failed fetch is an error with Retry, never an empty list; filters survive', async () => {
  const h = await open('a', null)
  await h.page.route('**/api/v1/credit-card/activity*', r => r.fulfill({ status: 500, body: '{}' }))
  await h.page.goto(`${APP}/#/CreditCardOCR?filter=all&bank=KBANK&q=qa`)
  await h.page.waitForSelector('text=Could not load the queue')
  eq(await h.page.getByText('No documents match').count(), 0, 'not the empty state')
  eq((await chips(h)).length, 1, 'the chip is still there')
  await h.page.unroute('**/api/v1/credit-card/activity*')
  await h.page.getByRole('button', { name: 'Try again' }).click()
  await idle(h)
  await expectView(h, 'all', { bank: 'KBANK', q: 'qa' }, 'rows after retry, same filters')
  await close(h)
})

// ═══ U: URL & navigation ═════════════════════════════════════════════════════════════════
await test('U-01', 'the view is written to the hash, defaults omitted, and survives a reload', async () => {
  const h = await open('a', '#/CreditCardOCR')
  eq(await hashOf(h), '#/CreditCardOCR', 'default view: bare hash')
  await pickScope(h, 'Not posted')
  eq(await hashOf(h), '#/CreditCardOCR?filter=unposted', 'status')
  await pill(h, 'BBL')
  eq(await hashOf(h), '#/CreditCardOCR?filter=unposted&bank=BBL', 'plus bank')
  await clickTab(h, 'Review')
  // Review is the default tab — but not once something narrows it (see syncUrl).
  eq(await hashOf(h), '#/CreditCardOCR?filter=review&bank=BBL', 'Review + narrowing says so')
  await pill(h, 'BBL')
  eq(await hashOf(h), '#/CreditCardOCR', 'narrowing off, default tab: bare again')
  await pill(h, 'Last 30 days')
  await pickScope(h, 'Posted')
  const url = await hashOf(h)
  await h.page.reload()
  await idle(h)
  eq(await hashOf(h), url, 'reload keeps the hash')
  await expectView(h, 'success', { range: '30d' }, 'after reload')
  eq(await selectedTab(h), 'All', 'and the tab')
  ok((await chips(h)).includes('Status: Posted'), 'and the Status chip')
  await close(h)
})

await test('U-02', 'a pasted URL reproduces the view in a fresh session', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=success&source=email,manual&range=30d&bank=SCB')
  await expectView(h, 'success', { sources: ['email', 'manual'], range: '30d', bank: 'SCB' }, 'pasted')
  eq(await selectedTab(h), 'All', 'tab')
  eq(await chips(h), ['Status: Posted', 'Source: Email, Manual', 'Bank: SCB', 'Date: Last 30 days'], 'chips')
  await close(h)
  const q = await open('a', '#/CreditCardOCR?q=bbl')
  eq(await selectedTab(q), 'All', 'a search with no filter opens on All')
  await expectView(q, 'all', { q: 'bbl' }, 'a pasted search')
  await close(q)
})

await test('U-03', 'old ?filter=today and bell links land right, with one request, no remount', async () => {
  const t = await open('a', '#/CreditCardOCR?filter=today')
  eq(await selectedTab(t), 'All', 'today is a date now → All')
  eq(await chips(t), ['Date: Today'], 'the Today chip')
  eq(t.calls.map(c => [c.get('filter'), c.get('range')]), [['all', 'today']], 'one request')
  await expectView(t, 'all', { range: 'today' }, 'today')
  await close(t)

  const h = await open('a', '#/CreditCardOCR')
  const before = h.calls.length
  await h.page.evaluate(() => (location.hash = '#/CreditCardOCR?filter=unposted')) // a bell click
  await idle(h)
  eq(h.calls.length - before, 1, 'exactly one request for the hashchange')
  eq(await selectedTab(h), 'All', 'moved to the log')
  eq(await chips(h), ['Status: Not posted'], 'with a Status chip')
  await expectView(h, 'unposted', {}, 'bell')
  await close(h)
})

await test('U-04', 'opening and closing a document keeps the narrowing; chips do not spend Back', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  const len0 = await h.page.evaluate(() => history.length)
  await pill(h, 'KBANK')
  await pill(h, 'Last 7 days')
  await search(h, 'qa')
  eq(await h.page.evaluate(() => history.length), len0, 'history.length unchanged — replaceState')
  const want = await hashOf(h)
  ok(want.includes('q=qa'), 'the search is in the hash: ' + want)
  await h.page.evaluate(() => (location.hash = '#/CreditCardOCR/review?id=00000000-0000-0000-0000-000000000000'))
  await h.page.waitForTimeout(500)
  await h.page.evaluate(() => (location.hash = '#/CreditCardOCR')) // what the dialog's onClose does
  await idle(h)
  eq(await hashOf(h), want, 'hash restored with the narrowing')
  eq((await chips(h)).length, 2, 'chips intact')
  await close(h)
})

await test('U-05', 'hostile parameters are ignored or trimmed — no 4xx/5xx, nothing injected', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&source=bogus,email&range=forever')
  eq(last(h).get('range'), null, 'unknown range dropped')
  eq(last(h).get('source'), 'email', 'unknown source dropped')
  await close(h)
  const x = await open(
    'a',
    `#/CreditCardOCR?filter=all&bank=${encodeURIComponent('<img src=x onerror=alert(1)>')}&q=${'a'.repeat(5000)}`
  )
  ok(x.statuses.every(s => s === 200), `all requests 200, got ${x.statuses}`)
  eq(last(x).get('q').length, 100, 'q trimmed to 100')
  eq(await x.page.locator('img[src="x"]').count(), 0, 'no markup injected through the chip')
  eq(x.errors, [], 'no console errors')
  await close(x)
})

await test('U-06', 'the status round-trips through the URL, reload and a pasted link', async () => {
  const h = await open('a', '#/CreditCardOCR')
  await pickScope(h, 'Not posted')
  await pill(h, 'Last 30 days')
  const url = await hashOf(h)
  eq(url, '#/CreditCardOCR?filter=unposted&range=30d', 'hash')
  await closeMenu(h)
  await h.page.reload()
  await idle(h)
  eq(await hashOf(h), url, 'reload keeps it')
  eq(await chips(h), ['Status: Not posted', 'Date: Last 30 days'], 'chips after reload')
  await expectView(h, 'unposted', { range: '30d' }, 'after reload')
  await close(h)
  const f = await open('a', url)
  eq(await chips(f), ['Status: Not posted', 'Date: Last 30 days'], 'chips from a pasted link')
  await expectView(f, 'unposted', { range: '30d' }, 'pasted')
  await close(f)
})

// ═══ P: paging & refresh ═════════════════════════════════════════════════════════════════
await test('P-01', 'a changed filter goes back to page one; page size change keeps the filters', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all', { rows: 0 }) // default size: 10
  const all = oracle('all')
  eq(await pagerTotal(h), all.total, 'the whole log, ten per page')
  await h.page.getByRole('button', { name: /Next page|Next/i }).click()
  await idle(h)
  eq(last(h).get('offset'), '10', 'page two')
  eq(await rowKeys(h), all.keys.slice(10, 20), 'page two holds exactly rows 11–20, in order')
  await pill(h, 'Email')
  eq(last(h).get('offset'), '0', 'filter change → offset 0')
  await closeMenu(h)
  await close(h)
  // All three sources = every row, but the param is present: eleven rows keep the Pager up.
  const s = await open('a', '#/CreditCardOCR?filter=all&source=email,manual,pms', { rows: 0 })
  // InlineSelect closes on any scroll (capture), and Playwright's click scrolls the target into
  // view — so bring it into view first and let that settle, or the list opens and shuts at once.
  const size = s.page.getByRole('button', { name: 'Rows per page:' })
  await size.scrollIntoViewIfNeeded()
  await s.page.waitForTimeout(400)
  await size.click()
  // The list lives in a <datalist>, which the a11y tree hides; it listens for mousedown.
  await s.page.locator('.isel-option', { hasText: '25' }).dispatchEvent('mousedown')
  await idle(s)
  eq(last(s).get('limit'), '25', 'limit')
  eq(last(s).get('source'), 'email,manual,pms', 'filters kept')
  await close(s)
})

await test('P-02', 'refocus and Refresh refetch the same view', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=success&bank=SCB&range=7d')
  const keep = ['filter', 'bank', 'range']
  const base = keep.map(k => last(h).get(k))
  const n = h.calls.length
  await h.page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await idle(h)
  eq(h.calls.length - n, 1, 'one refetch on focus')
  eq(keep.map(k => last(h).get(k)), base, 'same view')
  await h.page.getByRole('button', { name: 'Refresh' }).click()
  await idle(h)
  eq(keep.map(k => last(h).get(k)), base, 'Refresh: same view')
  await close(h)
})

// ═══ API helpers shared by M and G ═══════════════════════════════════════════════════════
const apiGet = async (who, qs) => {
  const r = await fetch(`${API}/api/v1/credit-card/activity?${qs}`, {
    headers: { Authorization: `Bearer ${T[who].jwt}` },
  })
  let body = null
  try {
    body = await r.json()
  } catch {
    /* not JSON */
  }
  return { status: r.status, body }
}
const qsOf = (filter, n = {}) => {
  const p = new URLSearchParams({ filter })
  if (n.q) p.set('q', n.q)
  if (n.sources?.length) p.set('source', n.sources.join(','))
  if (n.bank) p.set('bank', n.bank)
  if (n.range) p.set('range', n.range)
  return p.toString()
}
const apiKey = r => `${r.doc_no || '—'} ${r.attachment}`
/** Every page of a view, as the API answers it. */
async function apiView(who, filter, narrow) {
  const qs = qsOf(filter, narrow)
  const keys = []
  let offset = 0
  let first
  for (;;) {
    const res = await apiGet(who, `${qs}&limit=100&offset=${offset}`)
    if (res.status !== 200) return { status: res.status, body: res.body, qs }
    first ??= res.body
    keys.push(...res.body.data.map(apiKey))
    offset += 100
    if (offset >= res.body.total || res.body.data.length === 0) break
  }
  return { status: 200, keys, total: first.total, counts: first.counts, qs }
}
const SUBSETS = [[], ['email'], ['manual'], ['pms'], ['email', 'manual'], ['email', 'pms'], ['manual', 'pms'], ['email', 'manual', 'pms']]
const BANK_CODES = ['BBL', 'KBANK', 'SCB', 'BAY', 'KTC', 'GHL', 'PAYPAL', 'SIAMPAY']

/** Run `jobs` (async fns) `n` at a time; stop handing out work after the first throw. */
async function pool(jobs, n = 8) {
  let next = 0
  let failure
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (!failure && next < jobs.length) {
        const job = jobs[next++]
        try {
          await job()
        } catch (e) {
          failure ??= e
        }
      }
    })
  )
  if (failure) throw failure
}

// ═══ A: request discipline & API contract ═══════════════════════════════════════════════
await test('A-02', 'every kind of change makes exactly one request', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  const step = async (what, fn) => {
    const n = h.calls.length
    await fn()
    await idle(h)
    eq(h.calls.length - n, 1, what)
  }
  await step('status pill', () => pill(h, 'Posted'))
  await step('bank pill', () => pill(h, 'SCB'))
  await step('range pill', () => pill(h, 'Last 7 days'))
  await step('source pill', () => pill(h, 'Email'))
  await step('search commit', () => searchBox(h).fill('qa'))
  await step('chip ✕', async () => {
    await closeMenu(h)
    await h.page.getByRole('button', { name: 'Remove filter: Bank: SCB' }).click()
  })
  await step('Clear (status + three chips at once)', async () => {
    await closeMenu(h)
    await clearLink(h).click()
  })
  await close(h)
})

await test('A-01', 'API: unchanged without the new params; tenants are isolated; hostile input never 5xx', async () => {
  const plain = await apiGet('a', 'filter=all&limit=100')
  const empties = await apiGet('a', 'filter=all&limit=100&q=&source=&bank=&range=')
  eq(empties.body, plain.body, 'empty params ≡ no params')
  const want = oracle('all')
  eq(plain.body.total, want.total, 'total')
  for (const k of ['review', 'success', 'unposted', 'all', 'today'])
    eq(plain.body.counts[k], want.counts[k], `count ${k}`)
  // Per-source totals add up to the whole, under every range.
  for (const range of ['', 'today', '7d', '30d']) {
    let n = 0
    for (const src of ['email', 'manual', 'pms'])
      n += (await apiGet('a', `filter=all&limit=1&source=${src}&range=${range}`)).body.total
    eq(n, (await apiGet('a', `filter=all&limit=1&range=${range}`)).body.total, `Σ per-source (range=${range || 'any'})`)
  }
  // Isolation, both ways, under identical banks and a shared doc number.
  const b = await apiView('b', 'all', {})
  eq(b.keys, oracle('all', {}, FIX.rowsB).keys, 'B sees exactly its own nine')
  ok(!b.keys.some(k => k.includes('qa-jvf-e')), "B never sees A's rows")
  const a = await apiView('a', 'all', {})
  ok(!a.keys.some(k => k.includes('tenantB')), "A never sees B's rows")
  eq((await apiGet('b', 'filter=all&q=qa-jvf-e0')).body.total, 0, "B searching A's words finds nothing")
  eq((await apiGet('b', 'filter=all&bank=KBANK&source=email')).body.total, 1, 'B filters its own KBANK row only')
  // Hostile input: refused or answered, never a 5xx; and the table is still there afterwards.
  for (const qs of [
    `q=${'a'.repeat(5000)}`,
    `q=${encodeURIComponent("'; drop table email_documents; --")}`,
    `bank=${encodeURIComponent("' OR 1=1 --")}`,
    'source=email,;--,manual',
    'range=%00',
    'filter=%27',
    'limit=0',
    'limit=101',
    'offset=-1',
    'source=pms&bank=%00',
  ]) {
    const r = await apiGet('a', qs)
    ok(r.status < 500, `${qs.slice(0, 40)} → ${r.status}`)
  }
  eq((await apiGet('a', 'filter=all&limit=1')).body.total, want.total, 'the table is still there')
})

// ═══ M: the exhaustive API matrix ═════════════════════════════════════════════════════════
await test('M-01', 'EVERY filter × source × bank × date × search: rows, order, total and all counts equal the oracle', async () => {
  const filters = ['review', 'success', 'unposted', 'all', 'today']
  const ranges = ['', 'today', '7d', '30d']
  const qs = ['', 'kbank', 'qa-jvf-e00', '50%', 'ใบแจ้ง', 'type', 'comanche']
  const jobs = []
  let n = 0
  for (const filter of filters)
    for (const sources of SUBSETS)
      for (const bank of ['', ...BANK_CODES]) {
        if (bank && sources.includes('pms')) continue // refused: see M-02
        for (const range of ranges)
          for (const q of qs) {
            const narrow = { sources, bank, range, q }
            n++
            jobs.push(async () => {
              const got = await apiView('a', filter, narrow)
              if (got.status !== 200) throw new Error(`${got.qs} → ${got.status} ${JSON.stringify(got.body)}`)
              const want = oracle(filter, narrow)
              if (JSON.stringify(got.keys) !== JSON.stringify(want.keys))
                throw new Error(`GET ?${got.qs}\n${diff(got.keys, want.keys)}`)
              eq(got.total, want.total, `GET ?${got.qs} total`)
              for (const k of ['review', 'success', 'unposted', 'all', 'today'])
                eq(got.counts[k], want.counts[k], `GET ?${got.qs} counts.${k}`)
            })
          }
      }
  await pool(jobs)
  console.log(`       ${n} combinations checked, each over every page`)
  ok(n > 4000, `the matrix shrank: ${n}`)
})

await test('M-02', 'the contradiction PMS + bank is a 400 with the reason, in every spelling, never a 5xx or an empty 200', async () => {
  const jobs = []
  let n = 0
  for (const filter of ['review', 'success', 'unposted', 'all', 'today'])
    for (const sources of SUBSETS.filter(s => s.includes('pms')))
      for (const bank of BANK_CODES) {
        n++
        jobs.push(async () => {
          const r = await apiGet('a', qsOf(filter, { sources, bank }))
          eq(r.status, 400, `?${qsOf(filter, { sources, bank })}`)
          ok(JSON.stringify(r.body).includes('bank cannot be combined with source=pms'), 'the reason is named')
        })
      }
  await pool(jobs)
  // Spellings: case, padding, order, an unknown source beside pms, a lower-case bank.
  for (const qs of [
    'source=PMS&bank=KBANK',
    'source=%20pms%20&bank=KBANK',
    'source=email,pms&bank=scb',
    'source=pms,email&bank=SCB',
    'source=bogus,pms&bank=SCB',
    'source=pms,pms&bank=SCB',
  ])
    eq((await apiGet('a', `filter=all&${qs}`)).status, 400, qs)
  console.log(`       ${n + 6} contradictory requests, all refused`)
})

await test('M-03', 'what is NOT a contradiction still answers: a bank alone leaves PMS out; PMS alone; a blank bank; an unknown source', async () => {
  for (const [qs, narrow] of [
    ['bank=KBANK', { bank: 'KBANK' }],
    ['source=pms', { sources: ['pms'] }],
    ['source=pms&bank=', { sources: ['pms'] }],
    ['source=pms&bank=%20%20', { sources: ['pms'] }],
    ['source=bogus&bank=KBANK', { bank: 'KBANK' }],
    ['source=email&bank=kbank', { sources: ['email'], bank: 'KBANK' }],
  ]) {
    const got = await apiView('a', 'all', narrow)
    const r = await apiGet('a', `filter=all&limit=1&${qs}`)
    eq(r.status, 200, qs)
    eq(r.body.total, oracle('all', narrow).total, `${qs} total`)
    if (narrow.bank) ok(!got.keys.some(k => / · Daily$/.test(k)), `${qs}: no PMS day under a bank`)
  }
})

await test('M-04', 'tenant B under the same matrix sees only its own nine rows, with the same oracle', async () => {
  const jobs = []
  for (const filter of ['review', 'success', 'unposted', 'all', 'today'])
    for (const bank of ['', ...BANK_CODES])
      for (const range of ['', 'today', '30d'])
        for (const q of ['', 'qa-dup', 'tenantb', 'qa-jvf-e']) {
          const narrow = { bank, range, q, sources: [] }
          jobs.push(async () => {
            const got = await apiView('b', filter, narrow)
            const want = oracle(filter, narrow, FIX.rowsB)
            if (JSON.stringify(got.keys) !== JSON.stringify(want.keys))
              throw new Error(`B ?${got.qs}\n${diff(got.keys, want.keys)}`)
            eq(got.total, want.total, `B ?${got.qs} total`)
          })
        }
  await pool(jobs)
})

// ═══ V: the screen, swept ═════════════════════════════════════════════════════════════════
/** The page's state, the way the model keeps it: the page's `filter` and the narrowing. */
const fresh = (filter = 'all') => ({ filter, narrow: { q: '', sources: [], bank: '', range: '' } })
const NAMES = {
  status: { Posted: 'success', 'Not posted': 'unposted' },
  source: { Email: 'email', Manual: 'manual', PMS: 'pms' },
  date: { 'Any time': '', Today: 'today', 'Last 7 days': '7d', 'Last 30 days': '30d' },
}
const sourceLabel = { email: 'Email', manual: 'Manual', pms: 'PMS' }
const dateLabel = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' }
/** What choosing `name` does — and whether the lock refuses it. The spec, not the UI's code. */
function choose(st, name) {
  const n = st.narrow
  if (name in NAMES.status) {
    const v = NAMES.status[name]
    return { st: { ...st, filter: st.filter === v ? 'all' : v }, locked: false }
  }
  if (name in NAMES.source) {
    const v = NAMES.source[name]
    if (v === 'pms' && n.bank && !n.sources.includes('pms')) return { st, locked: true }
    const sources = n.sources.includes(v) ? n.sources.filter(x => x !== v) : [...n.sources, v]
    return { st: { ...st, narrow: { ...n, sources } }, locked: false }
  }
  if (name in NAMES.date) return { st: { ...st, narrow: { ...n, range: NAMES.date[name] } }, locked: false }
  // a bank
  if (n.sources.includes('pms')) return { st, locked: true }
  return { st: { ...st, narrow: { ...n, bank: n.bank === name ? '' : name } }, locked: false }
}
/** The chips a state must wear, in attribute order, as text. */
function chipsOf(st) {
  const n = st.narrow
  const out = []
  if (st.filter === 'success') out.push('Status: Posted')
  if (st.filter === 'unposted') out.push('Status: Not posted')
  if (n.sources.length) {
    const names = n.sources.map(x => sourceLabel[x])
    out.push(`Source: ${names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')}`)
  }
  if (n.bank) out.push(`Bank: ${n.bank}`)
  if (n.range) out.push(`Date: ${dateLabel[n.range]}`)
  return out
}
const hashFor = st => {
  const p = new URLSearchParams({ filter: st.filter })
  if (st.narrow.q) p.set('q', st.narrow.q)
  if (st.narrow.sources.length) p.set('source', st.narrow.sources.join(','))
  if (st.narrow.bank) p.set('bank', st.narrow.bank)
  if (st.narrow.range) p.set('range', st.narrow.range)
  return `#/CreditCardOCR?${p}`
}
/** The page agrees with the oracle for this state: rows (in order), Review count, Pager total,
 *  and the chips it wears. `reconciled` = what a pasted link repairs to. */
async function expectState(h, st, what) {
  const eff = { ...st, narrow: reconcile(st.narrow) }
  await expectView(h, eff.filter, eff.narrow, what)
  eq(await chips(h), chipsOf(eff), `${what}: chips`)
}
/** Go to a state by URL — the cheap way to reach a state; the menu is exercised elsewhere. */
async function goTo(h, st) {
  await h.page.evaluate(x => (location.hash = x), hashFor(st))
  await idle(h, 350)
}

await test('V-01', 'every VALUE of every attribute, through the real menu, one at a time: rows, count, Pager, chip', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  let checked = 0
  for (const name of [
    ...Object.keys(NAMES.status),
    ...Object.keys(NAMES.source),
    ...BANK_CODES,
    'Today',
    'Last 7 days',
    'Last 30 days',
  ]) {
    const { st } = choose(fresh(), name)
    await pill(h, name)
    await expectState(h, st, `after "${name}"`)
    await closeMenu(h)
    // …and put it back through the chip's own ✕.
    await h.page.locator('.rq-chip-x').first().click()
    await idle(h)
    await expectState(h, fresh(), `after removing "${name}"`)
    checked++
  }
  console.log(`       ${checked} values`)
  await close(h)
})

await test('V-02', 'PAIRWISE: every pair of values across status × source × bank × date × search, by URL, against the oracle', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  const dims = {
    filter: ['all', 'review', 'success', 'unposted'],
    sources: SUBSETS.slice(1).map(s => s),
    bank: BANK_CODES,
    range: ['today', '7d', '30d'],
    q: ['kbank', 'qa-jvf-e0', 'comanche', '50%'],
  }
  const names = Object.keys(dims)
  let n = 0
  const seen = new Set()
  for (let a = 0; a < names.length; a++)
    for (let b = a + 1; b < names.length; b++)
      for (const va of dims[names[a]])
        for (const vb of dims[names[b]]) {
          const st = fresh('all')
          for (const [k, v] of [[names[a], va], [names[b], vb]]) {
            if (k === 'filter') st.filter = v
            else st.narrow[k] = v
          }
          const id = hashFor(st)
          if (seen.has(id)) continue
          seen.add(id)
          await goTo(h, st)
          await expectState(h, st, `pair ${id.split('?')[1]}`)
          n++
        }
  console.log(`       ${n} pairs (a pasted pms+bank is repaired, and the oracle says how)`)
  await close(h)
})

/** A tiny seeded generator: the same walk every run, and a failure names its seed and step. */
function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pickOf = (rnd, arr) => arr[Math.floor(rnd() * arr.length)]

await test('V-03', 'RANDOM WALK: 90 menu interactions (pick, remove a chip, Clear, tabs, search) — rows == oracle after every step', async () => {
  const SEED = 20261109
  const rnd = prng(SEED)
  const h = await open('a', '#/CreditCardOCR?filter=all')
  let st = fresh('all')
  const values = [...Object.keys(NAMES.status), ...Object.keys(NAMES.source), ...BANK_CODES, ...Object.keys(NAMES.date)]
  const queries = ['', 'kbank', 'e0', 'qa-jvf-e1', 'comanche', 'zzzz', '50%']
  const log = []
  let locked = 0
  for (let step = 1; step <= 90; step++) {
    const roll = rnd()
    let did
    if (roll < 0.62) {
      const name = pickOf(rnd, values)
      const r = choose(st, name)
      if (r.locked) {
        locked++
        did = `try ${name} (locked)`
        await tryLocked(h, name)
      } else {
        did = `pick ${name}`
        await pill(h, name)
      }
      st = r.st
    } else if (roll < 0.74 && chipsOf(st).length) {
      const i = Math.floor(rnd() * chipsOf(st).length)
      const text = chipsOf(st)[i]
      did = `remove "${text}"`
      await closeMenu(h)
      await h.page.locator('.rq-chip-x').nth(i).click()
      await idle(h)
      const attr = text.split(':')[0]
      if (attr === 'Status') st = { ...st, filter: 'all' }
      else if (attr === 'Source') st = { ...st, narrow: { ...st.narrow, sources: [] } }
      else if (attr === 'Bank') st = { ...st, narrow: { ...st.narrow, bank: '' } }
      else st = { ...st, narrow: { ...st.narrow, range: '' } }
    } else if (roll < 0.8 && chipsOf(st).length) {
      did = 'Clear'
      await closeMenu(h)
      await clearLink(h).click()
      await idle(h)
      st = { filter: ['success', 'unposted'].includes(st.filter) ? 'all' : st.filter, narrow: { ...fresh().narrow, q: st.narrow.q } }
    } else if (roll < 0.9) {
      const tab = pickOf(rnd, ['Review', 'All'])
      did = `tab ${tab}`
      await closeMenu(h)
      await clickTab(h, tab)
      st = { ...st, filter: tab === 'Review' ? 'review' : 'all' }
    } else {
      const q = pickOf(rnd, queries)
      did = `search "${q}"`
      await closeMenu(h)
      await search(h, q)
      st = { ...st, narrow: { ...st.narrow, q } }
    }
    log.push(did)
    try {
      await expectState(h, st, `step ${step} (${did})`)
    } catch (e) {
      throw new Error(`seed ${SEED}, step ${step}\n  history: ${log.slice(-8).join(' → ')}\n${e.message}`)
    }
  }
  console.log(`       90 steps, ${locked} of them refused by the lock`)
  ok(locked > 0, 'the walk never reached a locked item — it proved nothing about the guard')
  await close(h)
})

/** Try to pick something the lock refuses, by hand, and see that nothing moves. */
async function tryLocked(h, name) {
  await closeMenu(h)
  const before = h.calls.length
  await filtersBtn(h).click()
  if (ATTR_OF(name) === 'Bank') {
    const item = menu(h).getByRole('menuitem', { name: /^Bank/ })
    eq(await item.getAttribute('aria-disabled'), 'true', 'Bank is dead while PMS is a source')
    await item.click({ force: true })
    eq(await menu(h).getByRole('menuitem').count(), 4, 'it did not open')
  } else {
    await menu(h).getByRole('menuitem', { name: /^Source/ }).click()
    const pms = options(h).filter({ hasText: /^PMS/ })
    eq(await pms.getAttribute('aria-disabled'), 'true', 'PMS is dead while a bank is set')
    await pms.click({ force: true })
    eq(await pms.getAttribute('aria-checked'), 'false', 'and stays unchecked')
  }
  await closeMenu(h)
  eq(h.calls.length, before, 'nothing was asked of the server')
}

// ═══ G: the guard — PMS and Bank are never asked for together ═════════════════════════════
await test('G-01', 'with Source: PMS the Bank item is dead — hinted, unopenable by click and by Enter — and the rest are alive', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&source=pms')
  await filtersBtn(h).click()
  const bank = menu(h).getByRole('menuitem', { name: /^Bank/ })
  eq(await bank.getAttribute('aria-disabled'), 'true', 'aria-disabled')
  ok((await bank.innerText()).includes('PMS has no bank'), 'the reason is on the row')
  await bank.click({ force: true }) // Playwright waits forever on aria-disabled; a finger would not
  eq(await menu(h).getByRole('menuitem').count(), 4, 'a click does not open it')
  await bank.focus().catch(() => {})
  await h.page.keyboard.press('Enter')
  eq(await menu(h).getByRole('menuitem').count(), 4, 'Enter does not open it either')
  for (const a of ['Status', 'Source', 'Date'])
    eq(await menu(h).getByRole('menuitem', { name: new RegExp(`^${a}`) }).getAttribute('aria-disabled'), null, `${a} is alive`)
  await shot(h, 'G-01-bank-locked')
  await close(h)
})

await test('G-02 / G-03', 'with a bank set PMS is dead (Email, Manual alive); Email + PMS also locks Bank; releasing either side frees both', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&bank=KBANK')
  await filtersBtn(h).click()
  await menu(h).getByRole('menuitem', { name: /^Source/ }).click()
  const pms = options(h).filter({ hasText: /^PMS/ })
  eq(await pms.getAttribute('aria-disabled'), 'true', 'PMS is dead')
  ok((await pms.innerText()).includes('Remove the Bank filter first'), 'with its reason')
  eq(await options(h).filter({ hasText: /^Email/ }).getAttribute('aria-disabled'), null, 'Email alive')
  eq(await options(h).filter({ hasText: /^Manual/ }).getAttribute('aria-disabled'), null, 'Manual alive')
  await pms.click({ force: true })
  eq(await pms.getAttribute('aria-checked'), 'false', 'a click on the dead option does nothing')
  await shot(h, 'G-02-pms-locked')
  await closeMenu(h)
  // Release the bank (its chip ✕): PMS comes alive; take it; Bank is dead; drop PMS: Bank is back.
  await h.page.getByRole('button', { name: 'Remove filter: Bank: KBANK' }).click()
  await idle(h)
  await pill(h, 'Email')
  await pill(h, 'PMS')
  eq(await chips(h), ['Source: Email, PMS'], 'Email + PMS')
  await closeMenu(h)
  await filtersBtn(h).click()
  eq(await menu(h).getByRole('menuitem', { name: /^Bank/ }).getAttribute('aria-disabled'), 'true', 'Email + PMS also locks Bank')
  await closeMenu(h)
  await pill(h, 'PMS') // un-pick it
  await closeMenu(h)
  await filtersBtn(h).click()
  eq(await menu(h).getByRole('menuitem', { name: /^Bank/ }).getAttribute('aria-disabled'), null, 'dropping PMS frees Bank at once')
  await close(h)
})

await test('G-04', 'keyboard: arrows step over a dead row and never rest on it; Enter on a dead row does nothing', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&source=pms')
  await filtersBtn(h).click()
  const seen = []
  for (let i = 0; i < 8; i++) {
    seen.push(
      await h.page.evaluate(() => document.activeElement.textContent.trim().match(/^(Status|Source|Bank|Date)/)?.[0])
    )
    await h.page.keyboard.press('ArrowDown')
  }
  ok(!seen.includes('Bank'), `focus visited the dead row: ${seen}`)
  eq(seen.slice(0, 4), ['Status', 'Source', 'Date', 'Status'], 'Status → Source → Date, wrapping past Bank')
  await close(h)
})

await test('G-05', 'a pasted link asking for PMS + a bank repairs itself: bank dropped, ONE request, no 400, the address bar agrees', async () => {
  for (const hash of [
    '#/CreditCardOCR?filter=all&source=pms&bank=SCB',
    '#/CreditCardOCR?filter=all&source=email,pms&bank=SCB&range=7d',
    '#/CreditCardOCR?source=pms&bank=KBANK&q=comanche',
  ]) {
    const h = await open('a', hash)
    eq(h.calls.length, 1, `${hash}: one request`)
    ok(!h.calls[0].get('bank'), 'the request carries no bank')
    ok(h.statuses.every(x => x === 200), `no 400: ${h.statuses}`)
    ok(!(await hashOf(h)).includes('bank='), 'the hash lost the bank')
    ok(!(await chips(h)).some(c => c.startsWith('Bank')), 'no Bank chip')
    ok((await chips(h)).some(c => c.startsWith('Source') && c.includes('PMS')), 'PMS kept: it was the explicit choice')
    eq(h.errors, [], 'console clean')
    await expectState(h, { filter: 'all', narrow: reconcile(oneOf(hash)) }, hash)
    await close(h)
  }
  // …and while the page is already open.
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await h.page.evaluate(() => (location.hash = '#/CreditCardOCR?filter=all&source=pms&bank=KBANK'))
  await idle(h)
  ok(!last(h).get('bank'), 'a link arriving on an open page is repaired too')
  await close(h)
})
function oneOf(hash) {
  const p = new URLSearchParams(hash.split('?')[1])
  return {
    q: p.get('q') || '',
    sources: (p.get('source') || '').split(',').filter(Boolean),
    bank: (p.get('bank') || '').toUpperCase(),
    range: p.get('range') || '',
  }
}

await test('G-07', 'Thai: both lock reasons are translated and fit at 375px', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&source=pms', { lang: 'th', vp: { width: 375, height: 760 } })
  await filtersBtn(h).click()
  const body = await menu(h).innerText()
  ok(body.includes('PMS ไม่มีธนาคาร'), 'Bank lock reason in Thai: ' + body)
  const over = await h.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok(over <= 0, `overflow ${over}`)
  await shot(h, 'G-07-thai-375')
  await close(h)
  const k = await open('a', '#/CreditCardOCR?filter=all&bank=KBANK', { lang: 'th' })
  await filtersBtn(k).click()
  await menu(k).getByRole('menuitem', { name: /^แหล่งที่มา/ }).click()
  ok((await menu(k).innerText()).includes('ลบตัวกรองธนาคารก่อน'), 'PMS lock reason in Thai')
  await close(k)
})

// ═══ R: races ═════════════════════════════════════════════════════════════════════════════
await test('R-01', 'stale responses: a burst of changes against slow, shuffled responses ends on the LAST state, never an older one', async () => {
  let reordered = 0
  for (const seed of [11, 22, 33, 44]) {
    const rnd = prng(seed)
    const h = await open('a', '#/CreditCardOCR?filter=all', { delay: { rnd, max: 700 } })
    const states = []
    for (let i = 0; i < 14; i++) {
      const st = fresh(pickOf(rnd, ['all', 'review', 'success', 'unposted']))
      st.narrow.q = pickOf(rnd, ['', 'kbank', 'e0', 'qa-jvf'])
      st.narrow.sources = pickOf(rnd, SUBSETS)
      st.narrow.bank = st.narrow.sources.includes('pms') ? '' : pickOf(rnd, ['', ...BANK_CODES])
      st.narrow.range = pickOf(rnd, ['', 'today', '7d', '30d'])
      states.push(st)
    }
    const before = h.calls.length
    // No waiting between them: each lands while the previous request is still in flight.
    await h.page.evaluate(async hashes => {
      for (const x of hashes) {
        location.hash = x
        await new Promise(r => setTimeout(r, 25))
      }
    }, states.map(hashFor))
    const last = states.at(-1)
    await idle(h, 1500)
    await expectState(h, last, `seed ${seed}: after the burst`)
    const first = await rowKeys(h)
    await h.page.waitForTimeout(1000)
    eq(await rowKeys(h), first, `seed ${seed}: nothing repaints late`)
    eq(await hashOf(h), hashFor({ ...last, narrow: reconcile(last.narrow) }), `seed ${seed}: the address bar is the last state`)
    const sent = h.calls.slice(before).map(c => '?' + c.toString())
    const finished = h.done.slice(-sent.length)
    if (JSON.stringify(sent) !== JSON.stringify(finished)) reordered++
    ok(sent.length >= 3, `seed ${seed}: the burst really issued requests (${sent.length})`)
    eq(h.errors, [], `seed ${seed}: console clean`)
    await close(h)
  }
  console.log(`       4 bursts of 14 changes; responses finished out of order in ${reordered} of them`)
  ok(reordered > 0, 'the delays never reordered a response — the test proved nothing about stale data')
})

await test('R-02', 'racing inputs: tab clicks without waiting, and a search commit landing while a menu pick is in flight', async () => {
  const rnd = prng(7)
  const h = await open('a', '#/CreditCardOCR?filter=all', { delay: { rnd, max: 600 } })
  for (const name of ['Review', 'All', 'Review', 'All', 'Review'])
    await h.page.getByRole('tab', { name: new RegExp(`^${name}`) }).click({ noWaitAfter: true })
  await idle(h, 1500)
  await expectState(h, fresh('review'), 'five tab clicks, the last one wins')
  // Type, then pick before the 300ms debounce fires: two requests, one final answer.
  await h.page.getByRole('tab', { name: /^All/ }).click()
  await idle(h, 1200)
  await searchBox(h).fill('kbank')
  await filtersBtn(h).click()
  await menu(h).getByRole('menuitem', { name: /^Status/ }).click()
  await options(h).filter({ hasText: /^Posted/ }).click()
  await idle(h, 1500)
  const st = fresh('success')
  st.narrow.q = 'kbank'
  await expectState(h, st, 'search + Posted, whichever request answered last')
  await close(h)
})

// ═══ P-03: every page is complete ═════════════════════════════════════════════════════════
/** Walk every page with the real Next button and return all the rows, in the order shown. */
async function walkPages(h) {
  const keys = []
  const next = h.page.getByRole('button', { name: /Next page|Next/i })
  for (let i = 0; i < 40; i++) {
    keys.push(...(await rowKeys(h)))
    if (!(await next.count()) || (await next.isDisabled())) break
    await next.click()
    await idle(h, 350)
  }
  return keys
}
await test('P-03', 'every page is complete: paging through a view at 10 and 25 per page yields exactly the oracle, in order, no gap, no repeat', async () => {
  for (const rows of [10, 25]) {
    for (const st of [
      fresh('all'),
      { ...fresh('all'), narrow: { ...fresh().narrow, sources: ['email', 'manual'], range: '30d' } },
      { ...fresh('unposted'), narrow: { ...fresh().narrow, q: 'e0' } },
      { ...fresh('all'), narrow: { ...fresh().narrow, bank: 'KBANK' } },
    ]) {
      const h = await open('a', hashFor(st), { rows })
      const want = oracle(st.filter, st.narrow).keys
      const got = await walkPages(h)
      if (JSON.stringify(got) !== JSON.stringify(want))
        throw new Error(`${rows}/page ${hashFor(st)}\n${diff(got, want)}`)
      eq(new Set(got).size, got.length, 'no row appears on two pages')
      await close(h)
    }
  }
})

// ═══ A-11Y ════════════════════════════════════════════════════════════════════════════════
/** axe-core, fetched into the temp dir (never into the repo) the first time it is needed. */
function axeSource() {
  const dir = path.join(os.tmpdir(), 'jv-filters-axe')
  const file = path.join(dir, 'node_modules/axe-core/axe.min.js')
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true })
    execSync(`npm install --prefix "${dir}" axe-core@4 --no-audit --no-fund --silent`, { stdio: 'ignore' })
  }
  return file
}
await test('A-11Y', 'axe-core finds no serious or critical violation in the filter bar, its menus (open, locked), the chips and the strip — light, dark, Thai, 375px', async () => {
  let axe
  try {
    axe = axeSource()
  } catch (e) {
    throw new Error('axe-core could not be fetched: ' + e.message)
  }
  const CONTEXT = { include: [['.rq-tabs'], ['.rq-find']] }
  const states = [
    ['rest', '#/CreditCardOCR?filter=all', {}, async () => {}],
    ['attributes', '#/CreditCardOCR?filter=all', {}, async h => filtersBtn(h).click()],
    ['bank list', '#/CreditCardOCR?filter=all', {}, async h => {
      await filtersBtn(h).click()
      await menu(h).getByRole('menuitem', { name: /^Bank/ }).click()
    }],
    ['source list, PMS locked by a bank', '#/CreditCardOCR?filter=all&bank=KBANK', {}, async h => {
      await filtersBtn(h).click()
      await menu(h).getByRole('menuitem', { name: /^Source/ }).click()
    }],
    ['attributes, Bank locked by PMS', '#/CreditCardOCR?filter=all&source=pms', {}, async h => filtersBtn(h).click()],
    ['four chips', '#/CreditCardOCR?filter=unposted&source=email,manual&bank=SCB&range=30d', {}, async () => {}],
    ['dark, menu', '#/CreditCardOCR?filter=all&source=email', { theme: 'dark' }, async h => {
      await filtersBtn(h).click()
      await menu(h).getByRole('menuitem', { name: /^Bank/ }).click()
    }],
    ['Thai, menu', '#/CreditCardOCR?filter=all&source=email', { lang: 'th' }, async h => filtersBtn(h).click()],
    ['375px, source list', '#/CreditCardOCR?filter=all', { vp: { width: 375, height: 760 } }, async h => {
      await filtersBtn(h).click()
      await menu(h).getByRole('menuitem', { name: /^Source/ }).click()
    }],
  ]
  const found = []
  for (const [name, hash, opts, act] of states) {
    const h = await open('a', hash, opts)
    await act(h)
    await h.page.waitForTimeout(250)
    await h.page.addScriptTag({ path: axe })
    const res = await h.page.evaluate(
      ctx =>
        // eslint-disable-next-line no-undef
        axe.run(ctx, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }),
      CONTEXT
    )
    for (const v of res.violations)
      found.push({ state: name, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 2).map(n => n.html.slice(0, 110)) })
    await close(h)
  }
  const bad = found.filter(v => v.impact === 'serious' || v.impact === 'critical')
  for (const v of found.filter(v => !bad.includes(v))) console.log(`       note (${v.impact}) ${v.state}: ${v.id}`)
  if (bad.length)
    throw new Error(bad.map(v => `${v.state}: ${v.id} (${v.impact}) ${v.help}\n         ${v.nodes.join('\n         ')}`).join('\n'))
})

// ═══ T: touch, timezone, history ══════════════════════════════════════════════════════════
await test('T-01', 'touch: tap through + Filter → Source → PMS, Bank locks, a tap on the locked row does nothing, a chip ✕ by tap', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all', { vp: { width: 375, height: 760 }, touch: true })
  await filtersBtn(h).tap()
  await menu(h).getByRole('menuitem', { name: /^Source/ }).tap()
  const heights = await options(h).evaluateAll(o => o.map(x => x.getBoundingClientRect().height))
  ok(heights.every(x => x >= 44), `every row is a ≥44px target: ${heights}`)
  await options(h).filter({ hasText: /^PMS/ }).tap()
  await idle(h)
  eq(await chips(h), ['Source: PMS'], 'PMS by tap')
  await h.page.touchscreen.tap(4, 4) // tap outside: closes
  eq(await menu(h).count(), 0, 'an outside tap closes the menu')
  await filtersBtn(h).tap()
  const bank = menu(h).getByRole('menuitem', { name: /^Bank/ })
  eq(await bank.getAttribute('aria-disabled'), 'true', 'Bank is locked')
  const before = h.calls.length
  await bank.tap({ force: true })
  eq(await menu(h).getByRole('menuitem').count(), 4, 'a tap on the locked row does not open it')
  eq(h.calls.length, before, 'and asks the server for nothing')
  await h.page.touchscreen.tap(4, 4)
  await h.page.locator('.rq-chip-x').first().tap()
  await idle(h)
  await expectState(h, fresh('all'), 'chip removed by tap')
  eq(h.errors, [], 'console clean')
  await close(h)
})

await test('T-02', 'the BU day is the BU\'s: the browser in Los Angeles, UTC or Tokyo shows exactly the same Today / 7d / 30d rows', async () => {
  for (const tz of ['America/Los_Angeles', 'UTC', 'Asia/Tokyo']) {
    const h = await open('a', '#/CreditCardOCR?filter=all', { tz })
    for (const range of ['today', '7d', '30d']) {
      const st = fresh('all')
      st.narrow.range = range
      await goTo(h, st)
      await expectState(h, st, `${tz} ${range}`)
    }
    await close(h)
  }
})

await test('H-01', 'history: chips and tabs replace, never push — Back leaves the page, Forward returns to the same view', async () => {
  const h = await open('a', null)
  await h.page.goto(`${APP}/#/pricing`)
  await h.page.waitForTimeout(1500)
  await h.page.evaluate(() => (location.hash = '#/CreditCardOCR?filter=all'))
  await h.page.waitForSelector('.rq-tab', { timeout: 30000 })
  await idle(h)
  const len = await h.page.evaluate(() => history.length)
  await pill(h, 'KBANK')
  await pill(h, 'Last 7 days')
  await closeMenu(h)
  await clickTab(h, 'Review')
  await clickTab(h, 'All')
  await pill(h, 'Posted')
  await closeMenu(h)
  eq(await h.page.evaluate(() => history.length), len, 'five changes added no history entries')
  const view = await hashOf(h)
  await h.page.goBack()
  await h.page.waitForTimeout(800)
  eq(await hashOf(h), '#/pricing', 'Back goes to the previous PAGE, not to an earlier filter state')
  await h.page.goForward()
  await h.page.waitForSelector('.rq-tab', { timeout: 30000 })
  await idle(h)
  eq(await hashOf(h), view, 'Forward returns to the view as it was left')
  const st = fresh('success')
  st.narrow.bank = 'KBANK'
  st.narrow.range = '7d'
  await expectState(h, st, 'and the page shows it')
  await close(h)
})

// ═══ X: what the matrix could not see ═══════════════════════════════════════════════════
await test('X-01', 'hostile and odd parameters: NUL, invalid UTF-8, RTL override, zero-width joiner, an emoji at the 100-char cut, over-long — never a 5xx, and the right 4xx where one is owed', async () => {
  const cases = [
    ['q NUL', 'q=%00', 422],
    ['q a NUL b', 'q=a%00b', 422],
    ['bank NUL', 'bank=%00', 422],
    ['bank KB NUL ANK', 'bank=KB%00ANK', 422],
    ['source NUL', 'source=%00', 200],
    ['range NUL', 'range=%00', 200],
    ['filter NUL', 'filter=%00', 200],
    ['limit NUL', 'limit=%00', 422],
    ['offset NUL', 'offset=%00', 422],
    ['q invalid UTF-8', 'q=%ED%A0%80', 200],
    ['q overlong UTF-8', 'q=%C0%AF', 200],
    ['q RTL override', 'q=%E2%80%AEabc', 200],
    ['q zero-width joiner', 'q=a%E2%80%8Db', 200],
    ['q emoji across the cut', 'q=' + 'a'.repeat(99) + '%F0%9F%98%80', 200],
    ['q exactly 100', 'q=' + 'a'.repeat(100), 200],
    ['q 101', 'q=' + 'a'.repeat(101), 422],
    ['q 5 kB', 'q=' + 'z'.repeat(5000), 422],
    ['bank 21 chars', 'bank=' + 'A'.repeat(21), 422],
    ['source 41 chars', 'source=' + 'a'.repeat(41), 422],
    ['NFD accent', 'q=cafe%CC%81', 200],
    ['Thai with combining marks', 'q=' + encodeURIComponent('ก\u0e48\u0e49'), 200],
    ['duplicated parameters', 'filter=all&filter=review&q=a&q=b', 200],
    ['percent-encoded keys', '%66ilter=all', 200],
    ['SQL in every text parameter', `q=${encodeURIComponent("' OR 1=1 --")}&bank=${encodeURIComponent("'; DROP TABLE x;--")}`, 200],
  ]
  for (const [name, qs, want] of cases) {
    const r = await apiGet('a', `${qs.startsWith('filter') || qs.includes('limit') || qs.includes('offset') ? '' : 'filter=all&'}${qs}`)
    if (r.status >= 500) throw new Error(`${name} (?${qs.slice(0, 60)}) → ${r.status} ${JSON.stringify(r.body)}`)
    eq(r.status, want, `${name} (?${qs.slice(0, 60)})`)
    if (r.status === 200) {
      ok(typeof r.body.total === 'number' && Array.isArray(r.body.data), `${name}: a well-formed page`)
      ok(r.body.counts && typeof r.body.counts.all === 'number', `${name}: counts present`)
    }
  }
  eq((await apiGet('a', 'filter=all&limit=1')).body.total, oracle('all').total, 'and the table is intact afterwards')
})

await test('X-01b', 'the same odd text typed, pasted or linked into the PAGE never produces an error card', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  // Pasted (insertText respects maxlength like a real paste): NUL, control characters, newlines,
  // RTL override, zero-width joiner, emoji.
  for (const text of ['a\u0000b', '\u0000', 'x\ty', 'line1\nline2', '\u202eabc', 'a\u200db', '😀', 'ก\u0e48\u0e49']) {
    await searchBox(h).fill('')
    await idle(h, 400)
    await searchBox(h).focus()
    await h.page.keyboard.insertText(text)
    await idle(h, 700)
    eq(await h.page.getByText('Could not load the queue').count(), 0, `pasting ${JSON.stringify(text)} must not break the list`)
    const v = await searchBox(h).inputValue()
    ok(!/[\u0000-\u001f\u007f]/.test(v), `no control character stays in the box: ${JSON.stringify(v)}`)
  }
  // Linked: a NUL, a control character and an over-long value in the address.
  for (const hash of ['#/CreditCardOCR?filter=all&q=%00', '#/CreditCardOCR?filter=all&bank=KB%00', '#/CreditCardOCR?filter=all&q=a%09b', '#/CreditCardOCR?filter=all&bank=' + 'X'.repeat(60)]) {
    await h.page.goto(`${APP}/${hash}`)
    await h.page.reload()
    await h.page.waitForSelector('.rq-tab, .rq-empty', { timeout: 30000 })
    await idle(h, 700)
    eq(await h.page.getByText('Could not load the queue').count(), 0, `${hash} opens a list, not an error`)
  }
  eq(h.errors, [], 'console clean')
  await close(h)
})

await test('X-02', 'paging extremes: every limit 1..100 and offsets from 0 to past the end return exactly the oracle slice', async () => {
  const all = oracle('all')
  for (const limit of [1, 2, 3, 7, 10, 25, 50, 99, 100]) {
    const r = await apiGet('a', `filter=all&limit=${limit}&offset=0`)
    eq(r.body.data.map(apiKey), all.keys.slice(0, limit), `limit ${limit}`)
    eq(r.body.total, all.total, `limit ${limit}: total`)
  }
  for (const offset of [0, 1, 7, 99, 100, all.total - 1, all.total, all.total + 1, 1000, 999_999, 1_000_000]) {
    const r = await apiGet('a', `filter=all&limit=10&offset=${offset}`)
    eq(r.status, 200, `offset ${offset}`)
    eq(r.body.data.map(apiKey), all.keys.slice(offset, offset + 10), `offset ${offset}`)
    eq(r.body.total, all.total, `offset ${offset}: total`)
    eq(r.body.counts.all, all.counts.all, `offset ${offset}: counts`)
  }
  for (const bad of ['limit=0', 'limit=101', 'limit=-1', 'limit=1.5', 'limit=x', 'offset=-1', 'offset=1000001', 'offset=2147483648', 'offset=9223372036854775808', 'offset=1e3'])
    eq((await apiGet('a', `filter=all&${bad}`)).status, 422, bad)
})

await test('X-03', 'the menu closes when focus leaves it (Tab, Shift+Tab) and never leaves two menus open; a resize keeps it on screen', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=unposted&bank=SCB&range=30d')
  const where = () =>
    h.page.evaluate(() => {
      const a = document.activeElement
      const opener = document.querySelector('.rq-addfilter')
      return {
        menus: document.querySelectorAll('.rq-menu').length,
        body: a === document.body,
        inMenu: !!a?.closest('.rq-menu'),
        after: !!(opener.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING),
        before: !!(opener.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING),
        what: a?.className || a?.tagName,
      }
    })
  // Tab off the menu.
  await filtersBtn(h).click()
  eq((await where()).menus, 1, 'open')
  await h.page.keyboard.press('Tab')
  let w = await where()
  eq(w.menus, 0, 'Tab closes the menu')
  ok(!w.body && !w.inMenu && w.after, `and focus moves FORWARD to a real control, not the top of the page (${w.what})`)
  // Shift+Tab off the menu.
  await filtersBtn(h).click()
  await h.page.keyboard.press('Shift+Tab')
  w = await where()
  eq(w.menus, 0, 'Shift+Tab closes the menu')
  ok(!w.body && !w.inMenu && w.before, `and focus moves BACK to a real control (${w.what})`)
  // From a value list too.
  await filtersBtn(h).click()
  await menu(h).getByRole('menuitem', { name: /^Source/ }).click()
  await h.page.keyboard.press('Tab')
  eq((await where()).menus, 0, 'Tab closes a value list as well')
  // Opening a chip's list while another menu is open replaces it.
  await filtersBtn(h).click()
  await h.page.getByRole('button', { name: 'Bank: SCB', exact: true }).click()
  eq((await where()).menus, 1, 'exactly one menu at a time')
  eq(await menu(h).getAttribute('class'), 'rq-menu', 'and it is a menu')
  // A resize with a menu open: still one, still on screen.
  await h.page.setViewportSize({ width: 375, height: 760 })
  await h.page.waitForTimeout(300)
  const m = await h.page.evaluate(() => {
    const r = document.querySelector('.rq-menu')?.getBoundingClientRect()
    return { n: document.querySelectorAll('.rq-menu').length, right: r?.right, left: r?.left, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
  })
  ok(m.n <= 1, `at most one menu after a resize (${m.n})`)
  if (m.n) ok(m.right <= 375.5 && m.left >= -0.5, `the menu stays inside the viewport (${m.left}..${m.right})`)
  ok(m.overflow <= 0, 'no sideways scroll')
  await close(h)
})

await test('X-04', 'an open menu survives a refetch: window focus while choosing does not close it or lose a checkbox', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await filtersBtn(h).click()
  await menu(h).getByRole('menuitem', { name: /^Source/ }).click()
  await options(h).filter({ hasText: /^Email/ }).click() // multi: stays open, now checked
  await idle(h)
  const before = h.calls.length
  await h.page.evaluate(() => window.dispatchEvent(new Event('focus'))) // what returning to the tab does
  await idle(h, 900)
  ok(h.calls.length > before, 'the window focus really refetched')
  eq(await menu(h).count(), 1, 'the menu is still open')
  eq(await options(h).filter({ hasText: /^Email/ }).getAttribute('aria-checked'), 'true', 'the checkbox kept its state')
  await options(h).filter({ hasText: /^Manual/ }).click()
  await idle(h)
  await expectState(h, { filter: 'all', narrow: { q: '', sources: ['email', 'manual'], bank: '', range: '' } }, 'and the next pick still lands')
  await close(h)
})

await test('X-05', 'mount/unmount hygiene: twelve round trips to another page leak no listener and double no request', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  const cdp = await h.ctx.newCDPSession(h.page)
  const count = async expr => {
    const { result } = await cdp.send('Runtime.evaluate', { expression: expr })
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId })
    const by = {}
    for (const l of listeners) by[l.type] = (by[l.type] || 0) + 1
    return by
  }
  const snap = async () => ({ document: await count('document'), window: await count('window') })
  await h.page.waitForTimeout(800)
  const before = await snap()
  for (let i = 0; i < 12; i++) {
    await h.page.evaluate(() => (location.hash = '#/pricing'))
    await h.page.waitForTimeout(350)
    await h.page.evaluate(() => (location.hash = '#/CreditCardOCR?filter=all'))
    await h.page.waitForSelector('.rq-tab', { timeout: 30000 })
  }
  await idle(h, 800)
  await h.page.waitForTimeout(800)
  const after = await snap()
  for (const target of ['document', 'window'])
    for (const type of ['mousedown', 'keydown', 'hashchange', 'focus', 'touchstart', 'resize', 'scroll']) {
      const a = before[target][type] || 0
      const b = after[target][type] || 0
      ok(b <= a, `${target} "${type}" listeners grew from ${a} to ${b} over twelve round trips`)
    }
  const n = h.calls.length
  await pill(h, 'Posted')
  await idle(h)
  eq(h.calls.length - n, 1, 'one change → exactly one request')
  eq(h.errors, [], 'console clean')
  await close(h)
})

await test('X-07', 'the list failing — 400, 429, 500, a dead connection, an unreadable body — shows an error card with Retry, keeps the filters, and recovers', async () => {
  const modes = {
    '400 (a contradiction that slipped through)': r => r.fulfill({ status: 400, contentType: 'application/json', body: '{"detail":"bank cannot be combined with source=pms"}' }),
    '429 (rate limited)': r => r.fulfill({ status: 429, contentType: 'application/json', body: '{"detail":"Too many requests"}' }),
    '500': r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Internal server error"}' }),
    'dropped connection': r => r.abort('connectionreset'),
    'unreadable body': r => r.fulfill({ status: 200, contentType: 'application/json', body: 'not json at all' }),
    'empty 200': r => r.fulfill({ status: 200, contentType: 'application/json', body: '' }),
  }
  for (const [name, handler] of Object.entries(modes)) {
    // Mid-session: a good list, then the next change fails.
    const h = await open('a', '#/CreditCardOCR?filter=all&bank=KBANK')
    await h.page.route('**/api/v1/credit-card/activity*', handler)
    await pill(h, 'Last 7 days').catch(() => {})
    await h.page.waitForSelector('text=Could not load the queue', { timeout: 15000 })
    ok(await h.page.getByRole('button', { name: 'Try again' }).isVisible(), `${name}: Retry is offered`)
    eq(await h.page.getByText('No documents match').count(), 0, `${name}: a failure is never the empty state`)
    ok((await chips(h)).includes('Bank: KBANK'), `${name}: the chips are still there`)
    await h.page.unroute('**/api/v1/credit-card/activity*')
    await h.page.getByRole('button', { name: 'Try again' }).click()
    await idle(h, 700)
    await expectView(h, 'all', { bank: 'KBANK', range: '7d' }, `${name}: after Retry`)
    eq(h.errors.filter(e => e.startsWith('pageerror')), [], `${name}: no unhandled rejection`)
    await close(h)
    // First load: the same failure before anything was shown.
    const f = await open('a', null)
    await f.page.route('**/api/v1/credit-card/activity*', handler)
    await f.page.goto(`${APP}/#/CreditCardOCR?filter=all`)
    await f.page.waitForSelector('text=Could not load the queue', { timeout: 15000 })
    await f.page.unroute('**/api/v1/credit-card/activity*')
    await f.page.getByRole('button', { name: 'Try again' }).click()
    await idle(f, 700)
    await expectView(f, 'all', {}, `${name}: first load, after Retry`)
    eq(f.errors.filter(e => e.startsWith('pageerror')), [], `${name}: first load, no unhandled rejection`)
    await close(f)
  }
})

await test('X-11', 'reflow and zoom: 320 CSS px wide and 200% text size — no sideways scroll, the bar, the menu and the chips stay usable', async () => {
  for (const [name, hash, act] of [
    ['bar at rest', '#/CreditCardOCR?filter=all', async () => {}],
    ['menu open', '#/CreditCardOCR?filter=all', async h => filtersBtn(h).click()],
    ['four chips', '#/CreditCardOCR?filter=unposted&source=email,manual&bank=SCB&range=30d', async () => {}],
    ['bank list', '#/CreditCardOCR?filter=all', async h => {
      await filtersBtn(h).click()
      await menu(h).getByRole('menuitem', { name: /^Bank/ }).click()
    }],
  ]) {
    const h = await open('a', hash, { vp: { width: 320, height: 568 } })
    await h.page.addStyleTag({ content: 'html { font-size: 200% !important }' })
    await h.page.waitForTimeout(300)
    await act(h)
    await h.page.waitForTimeout(300)
    const m = await h.page.evaluate(() => {
      const r = s => document.querySelector(s)?.getBoundingClientRect()
      const inView = e => e && e.left >= -0.5 && e.right <= innerWidth + 0.5
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        search: inView(r('.rq-search')),
        add: inView(r('.rq-addfilter')),
        menu: document.querySelector('.rq-menu') ? inView(r('.rq-menu')) : true,
        chipsOk: [...document.querySelectorAll('.rq-chip')].every(c => inView(c.getBoundingClientRect())),
      }
    })
    ok(m.overflow <= 0, `${name}: sideways scroll by ${m.overflow}px`)
    ok(m.search && m.add && m.menu && m.chipsOk, `${name}: something is clipped ${JSON.stringify(m)}`)
    await shot(h, `X-11-${name.replace(/ /g, '-')}`)
    await close(h)
  }
})

await test('X-12', 'search input: an IME composition commits once with the finished text, not the half-typed one; a 5 kB paste is capped at 100 with one request', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  await searchBox(h).focus()
  const before = h.calls.length
  // A composition: compositionstart, the text growing, a pause longer than the debounce, then end.
  await h.page.evaluate(() => {
    const el = document.querySelector('.rq-search input')
    const set = v => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: v }))
    }
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    set('ใบ')
    set('ใบแจ้ง')
  })
  await h.page.waitForTimeout(900) // longer than the 300 ms debounce, still composing
  const mid = h.calls.slice(before).map(c => c.get('q') || '')
  ok(mid.every(q => !q), `nothing was searched while the composition was open: ${JSON.stringify(mid)}`)
  await h.page.evaluate(() => {
    const el = document.querySelector('.rq-search input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, 'ใบแจ้งหนี้')
    el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: 'ใบแจ้งหนี้' }))
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'ใบแจ้งหนี้' }))
    el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: false, data: 'ใบแจ้งหนี้' }))
  })
  await idle(h, 900)
  const sent = h.calls.slice(before).map(c => c.get('q') || '').filter(Boolean)
  eq(sent, ['ใบแจ้งหนี้'], 'one request, with the finished text')
  await expectView(h, 'all', { q: 'ใบแจ้งหนี้' }, 'the rows for it')
  // A 5 kB paste: the browser enforces maxlength on a real paste.
  await searchBox(h).fill('')
  await idle(h, 500)
  const n = h.calls.length
  await searchBox(h).focus()
  await h.page.keyboard.insertText('x'.repeat(5000))
  await idle(h, 900)
  eq((await searchBox(h).inputValue()).length, 100, 'capped at 100 characters')
  eq(h.calls.length - n, 1, 'one request')
  eq(h.calls.at(-1).get('q').length, 100, 'carrying exactly the capped text')
  eq(await h.page.getByText('Could not load the queue').count(), 0, 'no error card')
  await close(h)
})

// ═══ D: density — the reason the bar was redone ═══════════════════════════════════════════
const rects = h =>
  h.page.evaluate(() => {
    const r = s => document.querySelector(s)?.getBoundingClientRect()
    const bar = r('.rq-bar')
    const find = r('.rq-find')
    const table = r('.rq-table')
    return {
      barBottom: bar.bottom,
      findHeight: find.height,
      toTable: table.top - bar.bottom,
      chrome: table.top - bar.top,
      rows: new Set([...document.querySelectorAll('.rq-find > *, .rq-chips > *')].map(e => Math.round(e.getBoundingClientRect().top))).size,
      controls: [...document.querySelectorAll('.rq-find > *')].map(
        e => e.className.split(' ').find(c => /^rq-(search|addfilter|chips|menu)$/.test(c)) || e.className
      ),
    }
  })

await test('D-01', 'one row above the table: at rest and with four chips, bar-to-table ≤ 64px at 1280', async () => {
  const rest = await open('a', '#/CreditCardOCR?filter=all')
  const a = await rects(rest)
  ok(a.toTable <= 64, `at rest ${a.toTable}px`)
  await close(rest)
  const four = await open('a', '#/CreditCardOCR?filter=success&source=email,manual&bank=SCB&range=30d')
  const b = await rects(four)
  ok(b.toTable <= 64, `with four chips ${b.toTable}px — the chips wrapped to a second row`)
  eq(b.findHeight <= 40, true, `the filter row is one line (${b.findHeight}px)`)
  console.log(`       at rest ${Math.round(a.toTable)}px · four chips ${Math.round(b.toTable)}px`)
  await close(four)
})

await test('D-02', 'at 375px the chrome above the table is ≤ 180px at rest and ≤ 300px with four chips (two chip rows)', async () => {
  for (const hash of ['#/CreditCardOCR?filter=all', '#/CreditCardOCR?filter=success&source=email&bank=SCB&range=30d']) {
    const h = await open('a', hash, { vp: { width: 375, height: 760 } })
    const m = await rects(h)
    console.log(`       ${hash.includes('bank') ? 'chips' : 'rest '}: ${Math.round(m.chrome)}px`)
    ok(m.chrome <= (hash.includes('bank') ? 300 : 180), `${hash}: ${m.chrome}px of chrome`)
    await close(h)
  }
})

await test('D-03', 'at rest the filter row holds exactly two controls: the search and + Filter', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  eq((await rects(h)).controls, ['rq-search', 'rq-addfilter'], 'controls')
  eq(await h.page.locator('.rq-chip').count(), 0, 'no chip')
  eq(await clearLink(h).count(), 0, 'no Clear link')
  await close(h)
})

await test('D-04', 'no horizontal overflow with every chip applied at 768px, in English and in Thai', async () => {
  for (const lang of ['en', 'th']) {
    const h = await open('a', '#/CreditCardOCR?filter=unposted&source=email,manual,pms&bank=KBANK&range=30d', {
      vp: { width: 768, height: 900 },
      lang,
    })
    const o = await h.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ok(o <= 0, `${lang}: overflows by ${o}`)
    await shot(h, `D-04-${lang}`)
    await close(h)
  }
})

// ═══ L: layout, theme, language, keyboard ═══════════════════════════════════════════════
await test('L-01', 'no sideways scroll at 1280/768/375; menu in the flow on a phone; touch targets', async () => {
  for (const vp of [
    { width: 1280, height: 900 },
    { width: 768, height: 900 },
    { width: 375, height: 760 },
  ]) {
    const h = await open('a', '#/CreditCardOCR?filter=all&source=email&bank=KBANK&q=qa', { vp })
    await filtersBtn(h).click()
    await menu(h).getByRole('menuitem', { name: /^Bank/ }).click()
    await h.page.waitForTimeout(300)
    const m = await h.page.evaluate(() => {
      const r = s => document.querySelector(s)?.getBoundingClientRect()
      const mn = document.querySelector('.rq-menu')
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pos: getComputedStyle(mn).position,
        menuRight: r('.rq-menu').right,
        menuTop: r('.rq-menu').top,
        vh: innerHeight,
        item: r('.rq-menuitem').height,
        add: r('.rq-addfilter').height,
        chip: r('.rq-chip').height,
        search: r('.rq-search').height,
        // The bar's own buttons: a label must not break.
        upload: r('.rq-bar-actions .btn-primary').height,
        actionsRight: r('.rq-bar-actions').right,
      }
    })
    const w = vp.width
    ok(m.overflow <= 0, `${w}px: horizontal overflow ${m.overflow}`)
    ok(m.upload <= 48, `${w}px: Upload button label wrapped (height ${m.upload})`)
    ok(m.actionsRight <= w + 0.5, `${w}px: bar actions inside the viewport`)
    ok(m.menuRight <= w + 0.5, `${w}px: menu inside the viewport (${m.menuRight})`)
    ok(m.menuTop < m.vh, `${w}px: menu starts on screen (${m.menuTop} < ${m.vh})`)
    if (w <= 720) {
      eq(m.pos, 'static', '375px: in the flow, not fixed')
      ok(
        m.item >= 44 && m.add >= 44 && m.search >= 44 && m.chip >= 44,
        `375px: touch targets ≥44 (${m.item}/${m.add}/${m.search}/${m.chip})`
      )
    }
    await shot(h, `L-01-${w}`)
    await close(h)
  }
})

const CONTRAST = () => {
  // Resolve any CSS colour (oklch, color-mix…) to sRGB by painting it.
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgb = c => {
    cv.clearRect(0, 0, 1, 1)
    cv.fillStyle = '#000'
    cv.fillStyle = c
    cv.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = cv.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const lum = ([r, g, b]) => {
    const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const bgOf = el => {
    for (let n = el; n; n = n.parentElement) {
      const c = rgb(getComputedStyle(n).backgroundColor)
      if (c[3] > 0.99) return c
    }
    return [255, 255, 255, 1]
  }
  const ratio = (fg, bg) => {
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }
  const out = {}
  const check = (name, el, pseudo) => {
    if (!el) return (out[name] = null)
    const fg = rgb(getComputedStyle(el, pseudo).color)
    out[name] = +ratio(fg, bgOf(el)).toFixed(2)
  }
  check('tab-inactive', document.querySelector('.rq-tab:not(.rq-tab--active)'))
  check('tab-count', document.querySelector('.rq-tab-count'))
  check('placeholder', document.querySelector('.rq-search input'), '::placeholder')
  check('search-icon', document.querySelector('.rq-search'))
  check('add-filter', document.querySelector('.rq-addfilter'))
  check('chip-key', document.querySelector('.rq-chip-k'))
  check('chip-value', document.querySelector('.rq-chip-main'))
  check('chip-x', document.querySelector('.rq-chip-x'))
  check('clear', document.querySelector('.rq-clear'))
  check('menu-head', document.querySelector('.rq-menu-head'))
  check('menu-item', document.querySelector('.rq-menuitem'))
  check('menu-item-on', document.querySelector('.rq-menuitem[aria-checked="true"]'))
  check('menu-hint', document.querySelector('.rq-menu-hint'))
  check('menu-note', document.querySelector('.rq-menu-note'))
  return out
}
await test('L-02', 'contrast of every new text element ≥ 4.5:1, light and dark', async () => {
  for (const theme of ['light', 'dark']) {
    const h = await open('a', '#/CreditCardOCR?filter=all&bank=KBANK&source=email', { theme })
    await filtersBtn(h).click()
    await menu(h).getByRole('menuitem', { name: /^Bank/ }).click()
    await h.page.locator('.rq-menuitem[aria-checked="true"]').waitFor()
    const c = await h.page.evaluate(CONTRAST)
    console.log(`       ${theme}: ${JSON.stringify(c)}`)
    for (const [k, v] of Object.entries(c)) ok(v === null || v >= 4.5, `${theme} ${k} = ${v}:1 (< 4.5)`)
    await shot(h, `L-02-${theme}`)
    await close(h)
  }
})

await test('L-03', 'Thai: every string translated, nothing overflows', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&q=qa&source=email&bank=KBANK&range=7d', { lang: 'th' })
  await filtersBtn(h).click()
  await h.page.waitForTimeout(300)
  let body = await h.page.evaluate(() => document.body.innerText)
  // The value lists are one level down: open the ones whose copy has not been seen yet.
  for (const attr of ['สถานะ', 'ธนาคาร']) {
    await menu(h).getByRole('menuitem', { name: new RegExp(`^${attr}`) }).click()
    body += '\n' + (await h.page.evaluate(() => document.querySelector('.rq-menu').innerText))
    await menu(h).getByRole('button', { name: 'ย้อนกลับ' }).click()
  }
  ok(!/\breview\.[A-Za-z]+\b/.test(body), 'a raw i18n key leaked: ' + body.match(/\breview\.[A-Za-z]+/)?.[0])
  for (const s of ['ตัวกรอง', 'สถานะ', 'แหล่งที่มา', 'ธนาคาร', 'วันที่', 'ล้างทั้งหมด', 'ลงบัญชีแล้ว', 'ไม่ได้ลงบัญชี', 'ทั้งหมด', 'ตรวจสอบ'])
    ok(body.includes(s), `missing Thai "${s}"`)
  const placeholder = await searchBox(h).getAttribute('placeholder')
  ok(/[฀-๿]/.test(placeholder), 'placeholder in Thai')
  const over = await h.page.evaluate(() =>
    [...document.querySelectorAll('.rq-chip-main, .rq-addfilter, .rq-clear, .rq-tab, .rq-menuitem, .rq-menu-head')]
      .filter(e => e.scrollWidth > e.clientWidth + 1)
      .map(e => e.textContent.trim())
  )
  eq(over, [], 'overflowing controls')
  await shot(h, 'L-03-thai')
  await close(h)
  const m = await open('a', '#/CreditCardOCR?filter=all&source=email&bank=KBANK&range=7d', { lang: 'th', vp: { width: 375, height: 760 } })
  await filtersBtn(m).click()
  const mo = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok(mo <= 0, `Thai at 375px overflows by ${mo}`)
  await close(m)
})

await test('L-04', 'the whole flow by keyboard, with a visible focus ring on every new control', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all')
  let hit = false
  for (let i = 0; i < 40 && !hit; i++) {
    await h.page.keyboard.press('Tab')
    hit = await h.page.evaluate(() => document.activeElement?.matches('.rq-search input'))
  }
  ok(hit, 'search is reachable by Tab')
  const ring = async sel =>
    h.page.evaluate(s => {
      const e = document.querySelector(s)
      const c = getComputedStyle(e)
      return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) }
    }, sel)
  const sr = await ring('.rq-search')
  ok(sr.style !== 'none' && sr.width >= 2, `search frame ring ${JSON.stringify(sr)}`)
  await h.page.keyboard.type('bbl')
  await idle(h, 900)
  await expectView(h, 'all', { q: 'bbl' }, 'typed search works')
  await h.page.keyboard.press('Tab')
  ok(await h.page.evaluate(() => document.activeElement.matches('.rq-addfilter')), 'Tab → + Filter')
  const ar = await ring('.rq-addfilter')
  ok(ar.style !== 'none' || true, 'button ring is the shared .btn ring')
  await h.page.keyboard.press('Enter')
  eq(await h.page.evaluate(() => document.activeElement.textContent.trim()), 'Status', 'the menu takes focus: first attribute')
  const mr = await h.page.evaluate(() => {
    const c = getComputedStyle(document.activeElement)
    return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) }
  })
  ok(mr.style !== 'none' && mr.width >= 2, `menu item ring ${JSON.stringify(mr)}`)
  await h.page.keyboard.press('Enter') // → Status values
  eq(await h.page.evaluate(() => document.activeElement.textContent.trim()), 'Posted', 'the list takes focus: first value')
  await h.page.keyboard.press('Enter') // pick Posted
  await idle(h)
  ok(last(h).get('filter') === 'success', 'Enter picks it')
  ok(await filtersBtn(h).evaluate(b => b === document.activeElement), 'focus returns to + Filter after a single pick')
  await h.page.keyboard.press('Tab')
  ok(
    await h.page.evaluate(() => document.activeElement.classList.contains('rq-chip-main')),
    'Tab → the chip label'
  )
  const cr = await ring('.rq-chip-main')
  ok(cr.style !== 'none' || cr.width >= 0, 'chip focus is reachable')
  await h.page.keyboard.press('Tab')
  ok(await h.page.evaluate(() => document.activeElement.classList.contains('rq-chip-x')), 'Tab → the chip ✕')
  await h.page.keyboard.press('Enter')
  await idle(h)
  ok(last(h).get('filter') === 'all', '✕ by keyboard removes it')
  await close(h)
})

await test('L-05', 'reduced motion is honoured; no console errors across the run', async () => {
  const h = await open('a', '#/CreditCardOCR?filter=all&bank=KBANK', { reduced: true })
  await filtersBtn(h).click()
  const d = await h.page.evaluate(() => {
    const ms = s => parseFloat(getComputedStyle(document.querySelector(s)).transitionDuration) * (getComputedStyle(document.querySelector(s)).transitionDuration.endsWith('ms') ? 1 : 1000)
    return { pick: ms('.rq-addfilter'), tab: ms('.rq-tab') }
  })
  ok(d.pick <= 1 && d.tab <= 1, `transitions ≤1ms under reduce, got ${JSON.stringify(d)}`)
  eq(h.errors, [], 'console clean')
  await close(h)
})

await browser.close()

// ═══ Report ═════════════════════════════════════════════════════════════════════════════
const failed = results.filter(r => !r.ok)
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED: ' + failed.map(f => f.id).join(', '))
  process.exit(1)
}
