/**
 * Every class a component renders must be defined in a stylesheet that component can reach.
 *
 *   node scripts/style-coverage.mjs        # or: npm run styles
 *
 * Exits non-zero when a component renders a class no reachable sheet defines, so it works
 * as a gate.
 *
 * Why this exists: on 2026-09-10 the AR reconciliation settings screen shipped styled by
 * nothing. It used `.container`, `.section` and `.skeleton-card`, which live only in
 * `pages/mapping.css` — a sheet imported by one other page — and it rendered `MappingRow`,
 * whose `.pm-*` rules lived in `components/payment-modal.css`, imported by a modal that was
 * not mounted. Worse, the grid's column template was declared on `.pm-inner`, an ancestor
 * that only exists inside that modal, so even loading the sheet would not have aligned it.
 *
 * tsc passed, eslint passed, 713 unit tests passed. A className is a string: nothing in the
 * toolchain reads it. This does.
 *
 * A sibling of contrast-audit.mjs, and here rather than in vitest for the same reason that
 * one is: vitest stubs CSS imports (`css: false`), so a test cannot read a stylesheet at all.
 */

import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'src')
const read = p => fs.readFileSync(p, 'utf8')

/** Comments are prose, not rules. Without this the tool reads its own explanation of a
 *  missing class as proof the class exists — which it did, for `.container`. */
const rules = css => css.replace(/\/\*[\s\S]*?\*\//g, ' ')

/** Sheets index.css pulls in — present on every page. */
const globalCss = [...read(path.join(SRC, 'index.css')).matchAll(/@import\s+'\.\/(.+?)'/g)]
  .map(m => rules(read(path.join(SRC, m[1]))))
  .join('\n')

/** The stylesheets a file imports itself. */
const ownCss = file =>
  [...read(file).matchAll(/import\s+'(.+?\.css)'/g)]
    .map(m => rules(read(path.resolve(path.dirname(file), m[1]))))
    .join('\n')

/** Class names in `className="..."` and in `` className={`...`} ``. */
const classesUsed = file => {
  const found = new Set()
  for (const m of read(file).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ')
    for (const cls of raw.split(/\s+/)) {
      // `foo--${x}` leaves the stem `foo--` once the interpolation is stripped: a prefix,
      // not a class anyone wrote.
      if (cls && !cls.endsWith('-')) found.add(cls)
    }
  }
  return [...found]
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Is `cls` the subject of a rule in this CSS — `.cls` not followed by more of a name, so
 *  `.section` does not match `.section-title`.
 *
 *  Built by concatenation rather than in a template literal on purpose: written as
 *  `` `\.${x}(?![\w-])` `` the backslashes are string escapes, and the regex compiles to
 *  `.cls(?![w-])` — a leading `.` that matches ANY character. That version reported every
 *  class as defined and passed a tree where the page was styled by nothing. */
const defines = (css, cls) => new RegExp('\\.' + escapeRe(cls) + '(?![\\w-])').test(css)

/** Applied through a parent selector or by an animation utility, not by a rule of their own. */
const STATE_WORDS = new Set(['active', 'ok', 'todo', 'missing', 'ready', 'bad', 'animate-spin'])

/**
 * The surfaces this guards. Not every file in the app: the older screens predate the rule
 * and lean on sheets loaded by whoever happens to be mounted, and rewriting them is a
 * separate job. Add a file here when you touch it.
 */
const SURFACE = [
  'pages/ARReconcileSettings.tsx',
  'components/ar-reconcile/ARMappingTable.tsx',
  'components/ar-reconcile/ARJvPreview.tsx',
  'components/ar-reconcile/ARReviewPane.tsx',
  'components/credit-card/JvHeaderCard.tsx',
  'pages/ReviewDocument.tsx',
  'components/common/MappingRow.tsx',
  'components/credit-card/PaymentTypeModal.tsx',
]

let failed = 0
for (const rel of SURFACE) {
  const file = path.join(SRC, rel)
  const own = ownCss(file)
  const missing = classesUsed(file).filter(
    c => !STATE_WORDS.has(c) && !defines(globalCss, c) && !defines(own, c)
  )
  if (missing.length) {
    failed++
    console.error(`  FAIL  ${rel}`)
    for (const c of missing) console.error(`          .${c} — no reachable sheet defines it`)
  } else {
    console.log(`  pass  ${rel}`)
  }

  // Borrowing another page's sheet would fix a symptom and drag that page's rules app-wide,
  // which is the trap index.css already warns about at length.
  if (/import\s+'.*styles\/pages\/(?!ar-reconcile)/.test(read(file))) {
    failed++
    console.error(`  FAIL  ${rel} imports another page's stylesheet`)
  }
}

// The column template has to travel with the rules that read it. On an ancestor it was
// resolvable only inside the modal that declared it.
const rowSheet = ownCss(path.join(SRC, 'components/common/MappingRow.tsx'))
if (!/--pm-cols:/.test(rowSheet) || !defines(rowSheet, 'pm-row')) {
  failed++
  console.error('  FAIL  MappingRow does not carry its own grid (--pm-cols / .pm-row)')
} else {
  console.log('  pass  MappingRow carries its own grid')
}

console.log(failed ? `\n${failed} problem(s).` : '\nEvery class resolves to a reachable sheet.')
process.exit(failed ? 1 : 0)
