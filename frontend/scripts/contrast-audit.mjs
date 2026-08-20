/**
 * WCAG contrast audit over the design tokens in styles/base.css.
 *
 *   node scripts/contrast-audit.mjs        # or: npm run contrast
 *
 * Exits non-zero if any pair below drops under its floor, so it works as a gate.
 *
 * Why this exists: on 2026-08-19 four filled buttons were shipping labels between
 * 1.4:1 and 2.2:1 — including "Generate Invoice → Carmen" and the warning modal's OK —
 * because each used a token tier meant for badges and borders as its background. None of
 * it was visible in review; all of it was obvious once measured. Parsing the tokens is
 * what makes it repeatable, so add a row here whenever a new fill or ink tier appears.
 *
 * FLOORS
 *   text  4.5:1   body text and button labels (WCAG 1.4.3)
 *   ui    3.0:1   control boundaries, large text, "is this shape visible" (1.4.11 / 1.4.3)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CSS_PATH = process.argv[2] ?? path.join(HERE, '..', 'src', 'styles', 'base.css')
const css = fs.readFileSync(CSS_PATH, 'utf8')

/** Pull the body of a rule, brace-matched so nested blocks don't truncate it. */
function grabBlock(selector) {
  const at = css.indexOf(selector)
  if (at < 0) throw new Error(`selector not found in ${CSS_PATH}: ${selector}`)
  const open = css.indexOf('{', at)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  throw new Error(`unbalanced braces after ${selector}`)
}

/**
 * Comments are stripped first. A prose comment containing `--foo: bar` would otherwise
 * be parsed as a declaration and shadow the real token — which happened while writing
 * this, and silently blanked one tier from the report.
 */
function parseTokens(block) {
  const tokens = {}
  for (const m of block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim()
  }
  return tokens
}

const light = parseTokens(grabBlock(':root {'))
const dark = { ...light, ...parseTokens(grabBlock("[data-theme='dark'] {")) }

function resolve(value, tokens, depth = 0) {
  if (depth > 12) throw new Error(`var() cycle at ${value}`)
  const whole = /^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/.exec(value.trim())
  if (whole) return resolve(tokens[whole[1]] ?? whole[2] ?? '', tokens, depth + 1)
  // Inline var() inside a colour, e.g. oklch(0.2 0.004 var(--neutral-h)).
  return value.replace(/var\((--[\w-]+)\)/g, (_, k) => tokens[k] ?? '0')
}

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function oklchToSrgb(L, C, hueDeg) {
  const h = (hueDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const encode = x => {
    const v = Math.min(1, Math.max(0, x))
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
  }
  return [
    encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

function toColor(input) {
  const str = input.trim()
  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(str)
  if (oklch) {
    const L = oklch[2] ? Number(oklch[1]) / 100 : Number(oklch[1])
    return { rgb: oklchToSrgb(L, Number(oklch[3]), Number(oklch[4])), alpha: Number(oklch[5] ?? 1) }
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(str)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { rgb: [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], alpha: 1 }
  }
  if (str === 'white') return { rgb: [1, 1, 1], alpha: 1 }
  if (str === 'black') return { rgb: [0, 0, 0], alpha: 1 }
  throw new Error(`unrecognised colour: ${input}`)
}

const luminance = ([r, g, b]) =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)

function ratio(fgSpec, bgSpec, tokens) {
  const fg = toColor(resolve(fgSpec, tokens))
  const bg = toColor(resolve(bgSpec, tokens))
  // Semi-transparent foregrounds (the border tiers) composite over their background in
  // sRGB space before the luminance is taken.
  const composited =
    fg.alpha < 1 ? fg.rgb.map((c, i) => c * fg.alpha + bg.rgb[i] * (1 - fg.alpha)) : fg.rgb
  const a = luminance(composited)
  const b = luminance(bg.rgb)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/**
 * [label, foreground, background, floor, darkOverride?]
 *
 * floor is 'text' (4.5:1) or 'ui' (3.0:1).
 *
 * A few components do not simply re-resolve their tokens in dark mode — base.css swaps
 * the whole declaration (`[data-theme='dark'] .btn-primary` moves to --primary-fill;
 * .btn-outline keeps --text-2 on a lightened surface instead of tinting). Those carry a
 * `{ fg, bg }` override so this measures what renders rather than what the light-theme
 * rule would have produced. If you add a dark override in CSS, add it here too.
 */
const PAIRS = [
  ['btn-primary label', 'white', 'var(--primary)', 'text', { bg: 'var(--primary-fill)' }],
  [
    'btn-primary hover',
    'white',
    'var(--primary-hover)',
    'text',
    { bg: 'var(--primary-fill-hover)' },
  ],
  ['btn-success label', 'white', 'var(--emerald-fill)', 'text'],
  ['btn-success hover', 'white', 'var(--emerald-fill-hover)', 'text'],
  ['btn-overwrite / danger:hover', 'white', 'var(--rose-fill)', 'text'],
  ['btn-overwrite hover', 'white', 'var(--rose-fill-hover)', 'text'],
  // No amber row: amber has no fill tier on purpose (see base.css). Modal confirms are
  // Carmen Blue regardless of type, so they are covered by the btn-primary rows above.
  ['modal icon: warning', 'var(--amber-text)', 'var(--amber-light)', 'ui'],
  ['modal icon: error', 'var(--rose-text)', 'var(--rose-light)', 'ui'],
  ['modal icon: success', 'var(--emerald-text)', 'var(--emerald-light)', 'ui'],
  // Dark keeps the neutral label and lightens the surface instead of tinting it primary.
  [
    'btn-outline hover label',
    'var(--primary)',
    'var(--primary-light)',
    'text',
    { fg: 'var(--text-2)', bg: 'var(--secondary)' },
  ],
  ['btn-danger label', 'var(--rose-text)', 'var(--rose-light)', 'text'],
  ['body text', 'var(--text)', 'var(--body-bg-oklch)', 'text'],
  ['text-2 on card', 'var(--text-2)', 'var(--card-bg)', 'text'],
  ['text-3 on card', 'var(--text-3)', 'var(--card-bg)', 'text'],
  ['placeholder / upload hint', 'var(--text-3)', 'var(--card-bg)', 'text'],
  ['badge warning', 'var(--amber-text)', 'var(--amber-light)', 'text'],
  ['badge error', 'var(--rose-text)', 'var(--rose-light)', 'text'],
  ['badge success', 'var(--emerald-text)', 'var(--emerald-light)', 'text'],
  ['badge info', 'var(--teal-text)', 'var(--teal-light)', 'text'],
  ['step wizard: upcoming', 'var(--text-3)', 'var(--muted)', 'ui'],
  ['step wizard: done', 'var(--emerald-text)', 'var(--muted)', 'text'],
  ['step wizard: active', 'var(--primary)', 'var(--card-bg)', 'text'],
  ['text-4 (decorative tier)', 'var(--text-4)', 'var(--card-bg)', 'ui'],
  ['text-4 on muted', 'var(--text-4)', 'var(--muted)', 'ui'],
  ['input border on card', 'var(--border-input)', 'var(--card-bg)', 'ui'],
  ['input border on muted', 'var(--border-input)', 'var(--muted)', 'ui'],
  ['success fill vs card', 'var(--emerald-fill)', 'var(--card-bg)', 'ui'],
  ['focus ring vs card', 'var(--primary)', 'var(--card-bg)', 'ui'],
]

const FLOORS = { text: 4.5, ui: 3.0 }
let failures = 0

for (const [themeName, tokens, isDark] of [
  ['LIGHT', light, false],
  ['DARK', dark, true],
]) {
  console.log(`\n===== ${themeName} =====`)
  for (const [label, lightFg, lightBg, kind, darkOverride] of PAIRS) {
    const o = (isDark && darkOverride) || {}
    const fg = o.fg ?? lightFg
    const bg = o.bg ?? lightBg
    const value = ratio(fg, bg, tokens)
    const ok = value >= FLOORS[kind]
    if (!ok) failures++
    console.log(
      `  ${ok ? 'pass' : 'FAIL'}  ${value.toFixed(2).padStart(5)}:1  (needs ${FLOORS[kind]})  ${label}`
    )
  }
}

console.log(
  failures === 0
    ? '\nAll token pairs meet their floor.'
    : `\n${failures} pair(s) under floor — fix the token, not the call site.`
)
process.exit(failures === 0 ? 0 : 1)
