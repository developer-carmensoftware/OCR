// The Changelog dialog the notification bell opens (monthly release notes, PR #403), on a real
// stack: browser → backend → the database it is pointed at, signed in through the SSO link.
//
//   backend:  backend/venv/Scripts/python -m uvicorn app.main:app --port 8011   (branch code)
//   frontend: vite on 3011 with /api proxied to 8011 (a scratch config spreading
//             frontend/vite.config.ts), or any deployed site through APP_URL
//   node scripts/qa/release_notes_ui.mjs
//
// Writes nothing but the login session: POST /notifications/mark-read is answered in the browser
// for the whole run, because notifications belong to the whole BU and a real "Mark all read"
// would clear everyone's bell. Server counts are read off the bell's own GET responses, so the
// suite runs unchanged on the QA site. Expected values come from VERSION and releaseNotes.ts,
// so the next monthly entry needs no edit here.
//
// S-1 the SSO link signs in (consent gate passed if shown)
// S-2 a fresh reader's badge = server unread + 1 (the unseen release)
// B-1 the bell's first row reads "What's new in {VERSION}"
// B-2 it is unread (dot), has the info icon, and no chevron
// B-3 clicking it sends no mark-read request
// D-1 the panel closes and a dialog named "Changelog" opens; the URL does not change
// D-2 one entry per release in releaseNotes.ts, newest first; the first pill is VERSION
// D-3 each entry's date line is "Release date DD/MM/YYYY"
// D-4 sections in order Key Features, New Features, Enhancements, none empty, counts as in the file
// D-5 every bullet reads "Name (Module): description"
// D-6 the New tag: every entry for a fresh reader, only the newest after an older one was seen
// D-7 the page behind is scroll-locked while open and unlocked after
// D-8 focus lands on the X; Tab and Shift+Tab stay inside the dialog
// C-1 the X closes it and focus returns to the bell
// C-2 Escape closes it
// C-3 a click outside closes it
// C-4 once opened, the release is read: badge = server unread, seen mark = newest date
// C-5 reopened, no New tag
// C-6 after a reload it is still read
// M-1 "Mark all read" sends one request for everything ({ids: null}) and reads the release too
// M-2 the badge drops to the server's own count
// F-1 fixture (30 rows, 5 unread): page 1 = the release row + 8 server rows, release first
// F-2 badge = 5 + 1
// F-3 page 2 has no release row and the badge stays 6
// F-4 a posted-document row opens its own detail dialog, marking only its id
// F-5 an approved-order row opens that order
// L-1 in Thai (header toggle) the row reads "มีอะไรใหม่ในเวอร์ชัน {VERSION}"
// L-2 Thai dialog: title, date line, section labels, close label, New tag
// L-3 Thai bullet counts per entry and section equal English
// V-1 desktop 1280×800: ≤ 560 px wide, centred, fits the screen, body scrolls, X ≥ 36 px
// V-2 phone 375×740: fills the screen, no sideways scroll, X on screen
// V-3 pill and bullet text ≥ 4.5:1 in light and dark
// G-1 the old #/whats-new link renders the app
// G-2 no uncaught page error
// G-3 the security headers sweep no longer visits #/whats-new (it sweeps the dialog instead)
//
// Env (defaults in brackets): APP_URL [http://localhost:3011], BU [carmen], CARMEN_URI
// [https://dev.carmen4.com], CARMEN_AUTHORIZATION [backend/.env], PLAYWRIGHT_CORE, CHROME_EXE
// [as review_payload_ui.mjs]. Never prints the token. Shots: .playwright-mcp/release-notes/.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, '.playwright-mcp/release-notes')
const APP = process.env.APP_URL || 'http://localhost:3011'
const BU = process.env.BU || 'carmen'
const URI = process.env.CARMEN_URI || 'https://dev.carmen4.com'
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local')
const PW =
  process.env.PLAYWRIGHT_CORE ||
  path.join(LOCAL, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core')
const CHROME =
  process.env.CHROME_EXE || path.join(LOCAL, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const { chromium } = createRequire(import.meta.url)(PW)

const envFile = path.join(ROOT, 'backend/.env')
const ENV = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
const TOKEN =
  process.env.CARMEN_AUTHORIZATION || ENV.match(/^CARMEN_AUTHORIZATION=(.*)$/m)?.[1]?.trim()

const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()
const notesUrl = pathToFileURL(path.join(ROOT, 'frontend/src/shared/content/releaseNotes.ts'))
const { RELEASE_NOTES } = await import(notesUrl.href) // Node 24 strips the types
const NEWEST = RELEASE_NOTES[0]
const dmy = iso => iso.split('-').reverse().join('/')
const LABEL = /^[^():]+ \([^()]+\): \S/
const SECTIONS = {
  en: [['keyFeatures', 'Key Features'], ['features', 'New Features'], ['enhancements', 'Enhancements']],
  th: [['keyFeatures', 'ฟีเจอร์หลัก'], ['features', 'ฟีเจอร์ใหม่'], ['enhancements', 'การปรับปรุง']],
}
/** What releaseNotes.ts says one entry should render: [[label, bulletCount], …]. */
const expectedSections = (r, lang) =>
  SECTIONS[lang].filter(([k]) => r[lang][k]?.length).map(([k, label]) => [label, r[lang][k].length])

const results = []
function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? `  (${detail})` : ''}`)
}

let page
const pageErrors = []
const markReads = [] // bodies of the intercepted POST /notifications/mark-read
let lastList = null // the bell's latest GET /notifications answer

async function shot(name) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
}

async function acceptConsent() {
  const confirm = page.locator('.uc-confirm-btn')
  if (await confirm.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
    await page.locator('.uc-check-row input[type="checkbox"]').check()
    await confirm.click()
    await page.locator('.uc-overlay').waitFor({ state: 'detached', timeout: 15000 })
  }
}

const bell = () => page.locator('.notif-bell__trigger').first()
const rows = () => page.locator('.notif-bell__item')
const changelog = name => page.getByRole('dialog', { name })
const isNotifList = r => /\/api\/v1\/notifications\?/.test(r.url()) && r.request().method() === 'GET'

/** The badge as drawn: '' when hidden, '9+' past nine. */
async function badgeText() {
  const b = page.locator('.notif-bell__badge').first()
  return (await b.count()) ? (await b.textContent()).trim() : ''
}
const badgeFor = n => (n > 9 ? '9+' : n > 0 ? String(n) : '')
const capNote = n => (n >= 9 ? ' — capped at 9+, the exact sum is checked by F-2' : '')

/** Reload and wait until the bell has its first list. */
async function reload() {
  const listed = page.waitForResponse(isNotifList, { timeout: 30000 })
  await page.reload()
  await bell().waitFor({ timeout: 30000 })
  await listed
  await page.waitForTimeout(400) // the response's JSON reaches state on the next render
}

async function setStorage(entries) {
  await page.evaluate(e => {
    for (const [k, v] of Object.entries(e)) {
      if (v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    }
  }, entries)
}

async function openChangelog(name = 'Changelog') {
  await bell().click()
  await rows().first().click()
  await changelog(name).waitFor({ timeout: 10000 })
  await page.waitForTimeout(300) // the rise animation, for the screenshots
}

/** Per entry: pill, date line, New tag, and [label, bullets] for each section. */
async function readEntries() {
  return page.locator('.relnotes-entry').evaluateAll(entries =>
    entries.map(e => ({
      pill: e.querySelector('.relnotes-version')?.textContent,
      date: e.querySelector('.relnotes-date')?.textContent,
      tagged: Boolean(e.querySelector('.relnotes-tag')),
      tag: e.querySelector('.relnotes-tag')?.textContent ?? null,
      sections: [...e.querySelectorAll('.relnotes-cat')].map(s => [
        s.querySelector('h3')?.textContent,
        s.querySelectorAll('li').length,
      ]),
      bullets: [...e.querySelectorAll('.relnotes-items li')].map(li => li.textContent),
    }))
  )
}

/** WCAG contrast of an element's text against a background colour, both read off the page. */
async function contrast(textSel, bgSel) {
  return page.evaluate(
    ([textSel, bgSel]) => {
      const rgb = c => {
        const cv = document.createElement('canvas').getContext('2d')
        cv.fillStyle = c
        cv.fillRect(0, 0, 1, 1)
        return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const lum = ([r, g, b]) => {
        const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const fg = getComputedStyle(document.querySelector(textSel)).color
      const bg = getComputedStyle(document.querySelector(bgSel)).backgroundColor
      const [hi, lo] = [lum(rgb(fg)), lum(rgb(bg))].sort((a, b) => b - a)
      return +((hi + 0.05) / (lo + 0.05)).toFixed(2)
    },
    [textSel, bgSel]
  )
}

// ── F fixture: 30 rows, newest first, 5 unread, four types in turn ──────────
const FIX_TOTAL = 30
const FIX_UNREAD = 5
const FIX_TYPES = ['document_posted', 'approved', 'document_failed', 'document_pending_review']
const fixRows = Array.from({ length: FIX_TOTAL }, (_, i) => {
  const type = FIX_TYPES[i % 4]
  const doc = { document_id: `doc-${i}`, attachment: `fixture-${i}.pdf`, doc_no: `F-${i}` }
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    order_id: type === 'approved' ? `order-${i}` : null,
    type,
    payload: {
      document_posted: { ...doc, bank_code: 'KBANK', jv_no: String(900 + i) },
      approved: { credits: 100 },
      document_failed: { ...doc, bank_code: 'KTC', reason_code: 'carmen_rejected', message: 'fixture' },
      document_pending_review: { pending: 3 },
    }[type],
    read_at: i < FIX_UNREAD ? null : new Date(Date.now() - i * 60000).toISOString(),
    created_at: new Date(Date.now() - i * 60000).toISOString(),
  }
})
async function serveFixture(route) {
  const u = new URL(route.request().url())
  const limit = Number(u.searchParams.get('limit') || 8)
  const offset = Number(u.searchParams.get('offset') || 0)
  await route.fulfill({
    json: { total: FIX_TOTAL, limit, offset, data: fixRows.slice(offset, offset + limit), unread_count: FIX_UNREAD },
  })
}

async function main() {
  if (!TOKEN) throw new Error('CARMEN_AUTHORIZATION is not set (env or backend/.env)')
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  page = await context.newPage()
  page.on('pageerror', err => pageErrors.push(String(err)))
  page.on('response', async r => {
    if (isNotifList(r) && r.ok()) lastList = await r.json().catch(() => lastList)
  })
  await page.route(/\/api\/v1\/notifications\/mark-read/, async route => {
    markReads.push(route.request().postDataJSON())
    await route.fulfill({ json: { updated: 0 } })
  })

  // ── S sign-in and start state ─────────────────────────────────────────────
  const sso = new URLSearchParams({ token: TOKEN, bu: BU, uri: URI })
  await page.goto(`${APP}/#/apinvoice?${sso}`)
  const signedIn = await page
    .waitForFunction(() => sessionStorage.getItem('ocr_access_token'), null, { timeout: 60000 })
    .then(() => true, () => false)
  await acceptConsent()
  check('S-1', `the SSO link signs in (BU ${BU})`, signedIn)
  if (!signedIn) throw new Error('not signed in: is CARMEN_AUTHORIZATION still alive?')

  await page.goto(`${APP}/#/apinvoice`) // drop the token from the URL before any reload
  await setStorage({ lang: 'en', theme: 'light', releaseNotesSeen: null })
  await reload()
  await acceptConsent()
  const server = lastList?.unread_count ?? 0
  check('S-2', 'a fresh reader\'s badge = server unread + 1', (await badgeText()) === badgeFor(server + 1),
    `server ${server}, badge "${await badgeText()}"${capNote(server)}`)

  // ── B the bell row ─────────────────────────────────────────────────────────
  await bell().click()
  const first = rows().first()
  const firstText = (await first.locator('.notif-bell__text').textContent()).trim()
  check('B-1', `the first row reads "What's new in ${VERSION}"`, firstText === `What's new in ${VERSION}`, firstText)
  const look = await first.evaluate(el => ({
    unread: el.classList.contains('is-unread') && Boolean(el.querySelector('.notif-bell__dot')),
    info: Boolean(el.querySelector('.notif-bell__icon--info')),
    chevron: Boolean(el.querySelector('.notif-bell__go')),
  }))
  check('B-2', 'it is unread, has the info icon and no chevron', look.unread && look.info && !look.chevron,
    JSON.stringify(look))
  const postsBefore = markReads.length
  await first.click()
  await changelog('Changelog').waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check('B-3', 'clicking it sends no mark-read request', markReads.length === postsBefore)

  // ── D the dialog ───────────────────────────────────────────────────────────
  const panelGone = (await page.locator('.notif-bell__panel').count()) === 0
  const hash = await page.evaluate(() => location.hash)
  check('D-1', 'the panel closes, "Changelog" opens, the URL stays', panelGone && hash === '#/apinvoice', hash)
  await shot('D-desktop-en-light')

  let entries = await readEntries()
  const pills = entries.map(e => e.pill)
  check('D-2', 'one entry per release, newest first, first pill = VERSION',
    JSON.stringify(pills) === JSON.stringify(RELEASE_NOTES.map(r => r.version)) && pills[0] === VERSION,
    `${pills.join(', ')} | VERSION ${VERSION}`)
  const dates = entries.map(e => e.date)
  check('D-3', 'each date line is "Release date DD/MM/YYYY"',
    JSON.stringify(dates) === JSON.stringify(RELEASE_NOTES.map(r => `Release date ${dmy(r.date)}`)), dates.join(' | '))
  const sections = entries.map(e => e.sections)
  const wantSections = RELEASE_NOTES.map(r => expectedSections(r, 'en'))
  check('D-4', 'sections and bullet counts are those of releaseNotes.ts',
    JSON.stringify(sections) === JSON.stringify(wantSections) && sections.every(s => s.length && s.every(([, n]) => n > 0)),
    JSON.stringify(sections))
  const bad = entries.flatMap(e => e.bullets).filter(b => !LABEL.test(b))
  check('D-5', 'every bullet reads "Name (Module): description"', bad.length === 0, bad.map(b => b.slice(0, 40)).join(' | '))
  const freshTags = entries.map(e => e.tagged)
  const lockedWhileOpen = await page.evaluate(() => document.body.style.overflow)

  const focus = () =>
    page.evaluate(() => ({
      label: document.activeElement?.getAttribute('aria-label'),
      inside: Boolean(document.activeElement?.closest('.ui-dialog')),
    }))
  const onOpen = await focus()
  await page.keyboard.press('Tab')
  const afterTab = await focus()
  await page.keyboard.press('Shift+Tab')
  const afterShiftTab = await focus()
  check('D-8', 'focus on the X, and Tab / Shift+Tab stay inside',
    onOpen.label === 'Close' && onOpen.inside && afterTab.inside && afterShiftTab.inside,
    JSON.stringify({ onOpen, afterTab, afterShiftTab }))

  // ── C close and seen-state ─────────────────────────────────────────────────
  await changelog('Changelog').locator('.ui-dialog__close').click()
  const closedByX = (await page.locator('.ui-dialog').count()) === 0
  const focusBack = await page.evaluate(() => document.activeElement?.classList.contains('notif-bell__trigger'))
  check('C-1', 'the X closes it and focus returns to the bell', closedByX && focusBack)
  const unlockedAfter = await page.evaluate(() => document.body.style.overflow)
  check('D-7', 'the page behind is locked while open, unlocked after',
    lockedWhileOpen === 'hidden' && unlockedAfter !== 'hidden', `open "${lockedWhileOpen}", closed "${unlockedAfter}"`)

  const seen = await page.evaluate(() => localStorage.getItem('releaseNotesSeen'))
  check('C-4', 'opened once, the release is read', (await badgeText()) === badgeFor(server) && seen === NEWEST.date,
    `badge "${await badgeText()}", server ${server}, seen ${seen}${capNote(server)}`)

  await openChangelog()
  entries = await readEntries()
  check('C-5', 'reopened, no New tag', entries.every(e => !e.tagged))
  await page.keyboard.press('Escape')
  check('C-2', 'Escape closes it', (await page.locator('.ui-dialog').count()) === 0)

  await openChangelog()
  await page.mouse.click(8, 420) // the backdrop, left of the 560 px box
  check('C-3', 'a click outside closes it', (await page.locator('.ui-dialog').count()) === 0)

  await reload()
  await bell().click()
  const stillRead = !(await rows().first().evaluate(el => el.classList.contains('is-unread')))
  await page.keyboard.press('Escape')
  check('C-6', 'after a reload it is still read',
    stillRead && (await badgeText()) === badgeFor(lastList?.unread_count ?? 0), `badge "${await badgeText()}"`)

  // D-6, second half: a reader who saw everything before the newest release.
  const dayBefore = new Date(`${NEWEST.date}T00:00:00Z`)
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
  await setStorage({ releaseNotesSeen: dayBefore.toISOString().slice(0, 10) })
  await reload()
  await openChangelog()
  const olderSeenTags = (await readEntries()).map(e => e.tagged)
  await page.keyboard.press('Escape')
  check('D-6', 'New tag: every entry when fresh, only the newest when older ones were seen',
    freshTags.every(Boolean) && olderSeenTags[0] && olderSeenTags.slice(1).every(t => !t),
    `fresh ${JSON.stringify(freshTags)}, older-seen ${JSON.stringify(olderSeenTags)}`)

  // ── M mark all read (intercepted) ─────────────────────────────────────────
  await setStorage({ releaseNotesSeen: null })
  await reload()
  const serverNow = lastList?.unread_count ?? 0
  await bell().click()
  const before = markReads.length
  const refreshed = page.waitForResponse(isNotifList, { timeout: 30000 })
  await page.getByRole('button', { name: 'Mark all read' }).click()
  await refreshed
  await page.waitForTimeout(400)
  const sent = markReads.slice(before)
  const rowRead = !(await rows().first().evaluate(el => el.classList.contains('is-unread')))
  const seenAfterAll = await page.evaluate(() => localStorage.getItem('releaseNotesSeen'))
  check('M-1', '"Mark all read" sends {ids: null} once and reads the release',
    sent.length === 1 && sent[0]?.ids === null && rowRead && seenAfterAll === NEWEST.date,
    `${JSON.stringify(sent)}, row read ${rowRead}, seen ${seenAfterAll}`)
  await page.keyboard.press('Escape')
  check('M-2', 'the badge drops to the server\'s own count', (await badgeText()) === badgeFor(lastList?.unread_count ?? 0),
    `badge "${await badgeText()}", server ${lastList?.unread_count} (before ${serverNow})${capNote(serverNow)}`)

  // ── F fixture notifications ───────────────────────────────────────────────
  await page.route(/\/api\/v1\/notifications\?/, serveFixture)
  await setStorage({ releaseNotesSeen: null })
  await reload()
  check('F-2', `badge = ${FIX_UNREAD} + 1`, (await badgeText()) === String(FIX_UNREAD + 1), `"${await badgeText()}"`)
  await bell().click()
  const page1 = await rows().evaluateAll(els => els.map(e => e.querySelector('.notif-bell__text')?.textContent))
  check('F-1', 'page 1 = the release row + 8 server rows, release first',
    page1.length === 9 && page1[0] === `What's new in ${VERSION}` && page1[1].includes('fixture-0.pdf'),
    `${page1.length} rows: ${page1.slice(0, 3).join(' | ')}`)
  await shot('F-bell-page1')
  const page2Loaded = page.waitForResponse(r => isNotifList(r) && r.url().includes('offset=8'))
  await page.getByRole('button', { name: 'Next page' }).click()
  await page2Loaded
  await page.waitForTimeout(300)
  const page2 = await rows().evaluateAll(els => els.map(e => e.querySelector('.notif-bell__text')?.textContent))
  check('F-3', 'page 2 has no release row, badge still 6',
    page2.length === 8 && !page2.some(t => t.startsWith("What's new")) && (await badgeText()) === '6',
    `${page2.length} rows, first "${page2[0]}", badge "${await badgeText()}"`)
  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.waitForTimeout(500)

  const postedBefore = markReads.length
  await rows().nth(1).click() // fixture-0: document_posted, unread
  const detail = page.getByRole('dialog', { name: 'Posted to Carmen' })
  const detailOpen = await detail.waitFor({ timeout: 10000 }).then(() => true, () => false)
  const noChangelog = (await changelog('Changelog').count()) === 0
  await page.waitForTimeout(300)
  const postedSent = markReads.slice(postedBefore)
  check('F-4', 'a posted-document row opens its own dialog and marks only its id',
    detailOpen && noChangelog && postedSent.length === 1 && JSON.stringify(postedSent[0]?.ids) === JSON.stringify([fixRows[0].id]),
    JSON.stringify(postedSent))
  await page.keyboard.press('Escape')
  await page.locator('.modal-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})

  await bell().click()
  await rows().nth(2).click() // fixture-1: approved order
  await page.waitForTimeout(500)
  const orderHash = await page.evaluate(() => location.hash)
  check('F-5', 'an approved-order row opens that order', orderHash === '#/pricing/orders?id=order-1', orderHash)
  await page.unroute(/\/api\/v1\/notifications\?/, serveFixture)
  await page.goto(`${APP}/#/apinvoice`)

  // ── L Thai, switched with the header toggle ───────────────────────────────
  await setStorage({ releaseNotesSeen: null })
  await reload()
  await page.locator('.lang-toggle').first().click()
  await page.waitForTimeout(300)
  await bell().click()
  const thRow = (await rows().first().locator('.notif-bell__text').textContent()).trim()
  check('L-1', `the row reads "มีอะไรใหม่ในเวอร์ชัน ${VERSION}"`, thRow === `มีอะไรใหม่ในเวอร์ชัน ${VERSION}`, thRow)
  await rows().first().click()
  const thOpen = await changelog('บันทึกการอัปเดต').waitFor({ timeout: 10000 }).then(() => true, () => false)
  await page.waitForTimeout(300)
  const th = await readEntries()
  const closeLabel = await page.locator('.ui-dialog__close').getAttribute('aria-label')
  check('L-2', 'Thai title, date line, sections, close label and New tag',
    thOpen &&
      JSON.stringify(th.map(e => e.date)) === JSON.stringify(RELEASE_NOTES.map(r => `วันที่เผยแพร่ ${dmy(r.date)}`)) &&
      JSON.stringify(th.map(e => e.sections.map(([l]) => l))) ===
        JSON.stringify(RELEASE_NOTES.map(r => expectedSections(r, 'th').map(([l]) => l))) &&
      closeLabel === 'ปิด' && th[0]?.tag === 'ใหม่',
    `${th[0]?.date} | ${JSON.stringify(th[0]?.sections)} | ${closeLabel} | ${th[0]?.tag}`)
  const thCounts = th.map(e => e.sections.map(([, n]) => n))
  const enCounts = RELEASE_NOTES.map(r => expectedSections(r, 'en').map(([, n]) => n))
  check('L-3', 'Thai bullet counts equal English', JSON.stringify(thCounts) === JSON.stringify(enCounts),
    `th ${JSON.stringify(thCounts)} en ${JSON.stringify(enCounts)}`)
  await shot('L-desktop-th')
  await page.keyboard.press('Escape')
  await page.locator('.lang-toggle').first().click() // back to English
  await page.waitForTimeout(300)

  // ── V layout and theme ────────────────────────────────────────────────────
  await openChangelog()
  const desk = await page.evaluate(() => {
    const box = document.querySelector('.ui-dialog').getBoundingClientRect()
    const body = document.querySelector('.ui-dialog__body')
    const x = document.querySelector('.ui-dialog__close').getBoundingClientRect()
    return {
      w: Math.round(box.width),
      offCentre: Math.round(Math.abs(box.left - (innerWidth - box.right))),
      fits: box.top >= 0 && box.bottom <= innerHeight,
      bodyScroll: getComputedStyle(body).overflowY,
      x: [Math.round(x.width), Math.round(x.height)],
    }
  })
  check('V-1', 'desktop: ≤ 560 px, centred, fits, body scrolls, X ≥ 36 px',
    desk.w <= 560 && desk.offCentre <= 2 && desk.fits && desk.bodyScroll === 'auto' && desk.x.every(v => v >= 36),
    JSON.stringify(desk))
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 375, height: 740 })
  await page.waitForTimeout(300)
  await openChangelog()
  const phone = await page.evaluate(() => {
    const box = document.querySelector('.ui-dialog').getBoundingClientRect()
    const body = document.querySelector('.ui-dialog__body')
    const x = document.querySelector('.ui-dialog__close').getBoundingClientRect()
    return {
      box: [box.left, box.top, box.width, box.height].map(Math.round),
      pageSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      bodySideways: body.scrollWidth > body.clientWidth,
      xOnScreen: x.right <= innerWidth && x.top >= 0,
    }
  })
  check('V-2', 'phone: fills the screen, no sideways scroll, X on screen',
    JSON.stringify(phone.box) === JSON.stringify([0, 0, 375, 740]) && !phone.pageSideways && !phone.bodySideways && phone.xOnScreen,
    JSON.stringify(phone))
  await shot('V-phone-en-light')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 800 })

  const ratios = {}
  for (const theme of ['light', 'dark']) {
    await setStorage({ theme })
    await reload()
    await openChangelog()
    ratios[theme] = {
      pill: await contrast('.relnotes-version', '.relnotes-version'),
      bullet: await contrast('.relnotes-items li', '.ui-dialog'),
    }
    if (theme === 'dark') await shot('V-desktop-en-dark')
    await page.keyboard.press('Escape')
  }
  await setStorage({ theme: 'light' })
  check('V-3', 'pill and bullet text ≥ 4.5:1 in light and dark',
    Object.values(ratios).every(r => r.pill >= 4.5 && r.bullet >= 4.5), JSON.stringify(ratios))

  // ── G regression ──────────────────────────────────────────────────────────
  await page.goto(`${APP}/#/whats-new`)
  await page.waitForTimeout(1500)
  const rendered = await page.locator('#root').evaluate(el => el.innerText.trim().length > 0)
  check('G-1', 'the old #/whats-new link renders the app', rendered && pageErrors.length === 0)
  const sweep = fs.readFileSync(path.join(ROOT, 'scripts/qa/security_headers_ui.mjs'), 'utf8')
  check('G-3', 'the security headers sweep visits the dialog, not #/whats-new',
    !sweep.includes('#/whats-new') && sweep.includes("visit('changelog'"))
  check('G-2', 'no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))

  await browser.close()
}

try {
  await main()
} catch (err) {
  console.error(err)
  if (page) await shot('failure').catch(() => {})
  results.push({ id: 'X', name: String(err), ok: false })
}
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
