// JV queue filters — the two cases that need something the main suite deliberately does not have:
// a BU with a lot of rows (X-09) and the product's own rate limiter (X-08).
//
//   python scripts/qa/jv_filters_e2e.py setup --big      # + tenant D with 20,000 rows
//   backend (the main suite's, lifted limits) on 8012:   jv_filters_backend.py
//   frontend: vite on 3012 proxying /api to 8012
//   node scripts/qa/jv_filters_load.mjs                  # X-08 starts its own backend on 8013
//   python scripts/qa/jv_filters_e2e.py explain          # plans for the same statements
//   python scripts/qa/jv_filters_e2e.py teardown
//
// X-09  scale. p50/p95 of the list for a BU with 20,000 rows — the whole log, a deep page, a
//       narrowed view, a search that matches thousands, a search that matches nothing — each 20
//       times; the totals and counts must equal what the fixture was built to contain; narrowing
//       must not cost more than 2.5x the unfiltered list; and the page itself must show the
//       count and page deep. The code says the merge-in-Python is fine "at this repo's volumes"
//       (342 rows). This is the first time it has met 20,000.
// X-08  the real limiter. A backend on 8013 with the shipped limits (120 requests / 60 s per IP
//       for the default group): a person's pace never trips it; a burst does, with a 429 the page
//       turns into an error card with Retry, and Retry works once the window has passed.
//
// Every number is printed, so a regression shows as a trend before it shows as a failure.

import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, '.playwright-mcp/jv-filters')
const APP = process.env.APP_URL || 'http://localhost:3012'
const API = process.env.API_URL || 'http://127.0.0.1:8012'
const LIMITED = 'http://127.0.0.1:8013'
const LOCAL = process.env.LOCALAPPDATA || path.join(process.env.HOME || '', 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

const FIX = JSON.parse(fs.readFileSync(path.join(OUT, 'fixture.json'), 'utf8'))
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean)
const results = []
async function test(id, name, fn) {
  if (ONLY.length && !ONLY.some(p => id.startsWith(p))) return
  const t0 = Date.now()
  try {
    await fn()
    results.push({ id, ok: true })
    console.log(`PASS ${id}  ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  } catch (e) {
    results.push({ id, ok: false })
    console.log(`FAIL ${id}  ${name}\n       ${String(e.message || e).split('\n').join('\n       ')}`)
  }
}
const ok = (c, what) => {
  if (!c) throw new Error(what)
}
const eq = (a, b, what) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}\n  got      ${JSON.stringify(a)}\n  expected ${JSON.stringify(b)}`)
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)]
const get = async (base, who, qs) => {
  const t0 = performance.now()
  const r = await fetch(`${base}/api/v1/credit-card/activity?${qs}`, { headers: { Authorization: `Bearer ${FIX.tenants[who].jwt}` } })
  const ms = performance.now() - t0
  let body = null
  try {
    body = await r.json()
  } catch {
    /* not JSON */
  }
  return { status: r.status, body, ms }
}

// ═══ X-09 ═════════════════════════════════════════════════════════════════════════════════
await test('X-09', 'scale: 20,000 rows — the right totals, narrowing within 2.5x of the unfiltered list, deep paging, and the page shows it', async () => {
  ok(FIX.tenants.d && FIX.big, 'run `jv_filters_e2e.py setup --big` first')
  const { expect, all } = FIX.big
  const first = await get(API, 'd', 'filter=all&limit=100')
  eq(first.status, 200, 'the big BU answers')
  eq(first.body.total, all, 'the whole log is every visible row the fixture holds')
  for (const k of ['review', 'success', 'unposted']) eq(first.body.counts[k], expect[k], `count ${k}`)
  eq(first.body.counts.all, all, 'count all')

  const scenarios = [
    ['the whole log, page 1', 'filter=all&limit=100'],
    ['a deep page (offset 19,900)', 'filter=all&limit=100&offset=19900'],
    ['Review only', 'filter=review&limit=100'],
    ['source + bank + 30 days', 'filter=all&limit=100&source=email&bank=KBANK&range=30d'],
    ['a search matching thousands', 'filter=all&limit=100&q=qa-big-e1'],
    ['a search matching nothing', 'filter=all&limit=100&q=zzzzzzzz'],
    ['the whole log, 1 row', 'filter=all&limit=1'],
  ]
  const stats = {}
  for (const [name, qs] of scenarios) {
    await get(API, 'd', qs) // warm
    const t = []
    for (let i = 0; i < 20; i++) {
      const r = await get(API, 'd', qs)
      eq(r.status, 200, `${name}`)
      t.push(r.ms)
    }
    stats[name] = { p50: pct(t, 50), p95: pct(t, 95), max: Math.max(...t) }
    console.log(`       ${name.padEnd(32)} p50 ${stats[name].p50.toFixed(0).padStart(5)} ms   p95 ${stats[name].p95.toFixed(0).padStart(5)} ms   max ${stats[name].max.toFixed(0).padStart(5)} ms`)
  }
  const base = stats['the whole log, page 1'].p95
  for (const name of ['source + bank + 30 days', 'a search matching thousands', 'a search matching nothing', 'Review only'])
    ok(stats[name].p95 <= Math.max(2.5 * base, base + 150), `${name}: p95 ${stats[name].p95.toFixed(0)} ms is more than 2.5x the unfiltered ${base.toFixed(0)} ms`)
  for (const [name, s] of Object.entries(stats)) ok(s.p95 < 2000, `${name}: p95 ${s.p95.toFixed(0)} ms is over the 2 s budget`)

  // The page itself: the total on the Pager, and Next from page 1 into the deep.
  const browser = await chromium.launch({ executablePath: CHROME })
  const t = FIX.tenants.d
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(({ jwt, user }) => {
    sessionStorage.setItem('ocr_access_token', jwt)
    sessionStorage.setItem('ocr_user:v1', JSON.stringify(user))
    localStorage.setItem('lang', 'en')
    localStorage.setItem('rowsPerPage', '100')
    localStorage.setItem(`ocr_consent_v2_${user.tenant_id}`, '1')
  }, { jwt: t.jwt, user: t.user })
  const page = await ctx.newPage()
  const t0 = Date.now()
  await page.goto(`${APP}/#/CreditCardOCR?filter=all`)
  await page.waitForSelector('.rq-table tbody tr.rq-row', { timeout: 30000 })
  const firstPaint = Date.now() - t0
  const range = await page.locator('.pager__range').innerText()
  console.log(`       first rows on screen after ${firstPaint} ms; the Pager reads "${range.replace(/\s+/g, ' ')}"`)
  ok(range.replace(/,/g, '').includes(String(all)), `the Pager says the whole count (${all}): ${range}`)
  ok(firstPaint < 6000, `first paint took ${firstPaint} ms`)
  const next = page.getByRole('button', { name: /Next page|Next/i })
  const seen = new Set()
  for (let i = 0; i < 8; i++) {
    const keys = await page.evaluate(() => [...document.querySelectorAll('.rq-table tbody tr.rq-row')].map(tr => tr.querySelector('.rq-file')?.textContent.trim() + tr.querySelector('.rq-docno')?.textContent.trim()))
    ok(keys.length === 100, `page ${i + 1} holds 100 rows, not ${keys.length}`)
    for (const k of keys) {
      ok(!seen.has(k), `${k} appears on two pages`)
      seen.add(k)
    }
    await next.click()
    await page.waitForTimeout(700)
  }
  await ctx.close()
  await browser.close()
})

// ═══ X-08 ═════════════════════════════════════════════════════════════════════════════════
await test('X-08', 'the real limiter: a human pace never trips it; a burst gets a 429, the page shows an error card with Retry, and Retry works after the window', async () => {
  const py = path.join(ROOT, 'backend/venv/Scripts/python.exe')
  const child = spawn(py, [path.join(ROOT, 'scripts/qa/jv_filters_backend.py'), '--real-limits', '--port', '8013'], {
    env: { ...process.env, DATABASE_URL: 'postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres' },
    stdio: 'ignore',
  })
  const stop = () => {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
    } catch {
      /* already gone */
    }
  }
  try {
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch(`${LIMITED}/api/version`)).ok) break
      } catch {
        /* not up yet */
      }
      await sleep(500)
    }
    // 1. A person's pace: a filter change every 2 s for a minute is 30 requests.
    const human = []
    for (let i = 0; i < 30; i++) {
      human.push((await get(LIMITED, 'a', `filter=all&limit=25&range=${['', 'today', '7d', '30d'][i % 4]}`)).status)
      await sleep(2000)
    }
    eq(human.filter(s => s !== 200), [], 'a change every two seconds is never limited')
    await sleep(31000) // let the minute's window slide past the human requests

    // 2. A burst.
    const burst = await Promise.all(Array.from({ length: 140 }, () => get(LIMITED, 'a', 'filter=all&limit=1')))
    const limited = burst.filter(r => r.status === 429)
    console.log(`       140 requests in ${Math.max(...burst.map(r => r.ms)).toFixed(0)} ms: ${burst.length - limited.length} answered, ${limited.length} limited`)
    ok(limited.length > 0, 'the limiter never engaged: 140 requests in a burst all passed')
    ok(JSON.stringify(limited[0].body).toLowerCase().includes('too many'), `a 429 says why: ${JSON.stringify(limited[0].body)}`)
    ok(burst.filter(r => r.status >= 500).length === 0, 'and nothing was a 5xx')

    // 3. The page, through the same limiter, while it is exhausted — and afterwards.
    const browser = await chromium.launch({ executablePath: CHROME })
    const t = FIX.tenants.a
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addInitScript(({ jwt, user }) => {
      sessionStorage.setItem('ocr_access_token', jwt)
      sessionStorage.setItem('ocr_user:v1', JSON.stringify(user))
      localStorage.setItem('lang', 'en')
      localStorage.setItem('rowsPerPage', '25')
      localStorage.setItem(`ocr_consent_v2_${user.tenant_id}`, '1')
    }, { jwt: t.jwt, user: t.user })
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', e => pageErrors.push(String(e)))
    // `/api/v1/`, not `/api/`: the dev server's own modules live under /src/shared/api/ too.
    await page.route('**/api/v1/**', async route => {
      const u = new URL(route.request().url())
      const response = await route.fetch({ url: `${LIMITED}${u.pathname}${u.search}` })
      await route.fulfill({ response })
    })
    await sleep(61000) // the window the burst used up
    await page.goto(`${APP}/#/CreditCardOCR?filter=all`)
    await page.waitForSelector('.rq-table tbody tr.rq-row', { timeout: 30000 })
    const before = await page.evaluate(() => document.querySelectorAll('.rq-table tbody tr.rq-row').length)
    ok(before > 0, 'the page loads once the limiter has recovered')
    // Exhaust the window from the page's own IP, then change a filter.
    await Promise.all(Array.from({ length: 140 }, () => get(LIMITED, 'a', 'filter=all&limit=1')))
    await page.evaluate(() => (location.hash = '#/CreditCardOCR?filter=all&range=7d'))
    await page.waitForSelector('text=Could not load the queue', { timeout: 15000 })
    ok(await page.getByRole('button', { name: 'Try again' }).isVisible(), 'a 429 shows the error card with Retry — not a blank page and not "no documents"')
    eq(await page.getByText('No documents match').count(), 0, 'and it is never the empty state')
    await sleep(61000)
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.waitForSelector('.rq-table tbody tr.rq-row', { timeout: 15000 })
    ok((await page.evaluate(() => document.querySelectorAll('.rq-table tbody tr.rq-row').length)) > 0, 'Retry works once the window has passed')
    eq(pageErrors, [], 'no unhandled rejection through the whole episode')
    await ctx.close()
    await browser.close()
  } finally {
    stop()
  }
})

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED: ' + failed.map(f => f.id).join(', '))
  process.exit(1)
}
