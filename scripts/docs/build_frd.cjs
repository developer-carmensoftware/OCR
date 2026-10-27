// Build an FRD .docx from its markdown source in docs/frd/.
//
// The FRD series (Carmen Cloud ERP FRD Template v1.1) was first generated with docx-js
// and the markdown was thrown away, so every revision meant prying text back out of
// Word. The markdown is now the source; this script is the only thing that knows the
// template's look (A4, Leelawadee, the 1F4E79 headings, DCE6F1 table heads).
//
// Run (docx is a global npm package; playwright-core is the npx-cached one, used only
// to render ```mermaid blocks, which are cached by content hash in the OS temp dir):
//
//   NODE_PATH="$(npm root -g);$LOCALAPPDATA/npm-cache/_npx/e41f203b7505f1fb/node_modules" \
//     node scripts/docs/build_frd.cjs docs/frd/FRD-12-*.md --out <dir>
//
//   --check   only verify that every `backticked` path, endpoint and identifier exists
//             in backend/, frontend/src/, supabase/, scripts/ — a name the code does not
//             have must not reach a customer document. Exits 1 on a miss. A name that
//             is legitimately not ours (a Carmen endpoint) goes in `check-ignore:`.
//
// Markdown subset: front matter (cover), # ## ### headings, paragraphs, - / 1. lists
// (two levels), | tables (<!-- widths: 20,30,50 --> before one overrides the column
// split), ``` code, ```mermaid <n> | <caption>, > **Label:** note, <!-- pagebreak -->,
// inline **bold**, *italic*, `code`.

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const d = require('docx')
/* global mermaid -- lives in the page that renders the diagrams */

const FONT = 'Leelawadee'
const MONO = 'Consolas'
const PAGE_W = 9746 // A4 minus 0.75" margins, in DXA
const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1223/chrome-win64/chrome.exe')
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js'
const ROOT = path.resolve(__dirname, '../..')

// ── markdown → blocks ────────────────────────────────────────────────────────

function parse(src) {
  const lines = src.replace(/\r/g, '').split('\n')
  const meta = []
  let i = 0
  if (lines[0] === '---') {
    for (i = 1; lines[i] !== '---'; i++) {
      const m = lines[i].match(/^([^:]+):\s*(.*)$/)
      if (m) meta.push([m[1].trim(), m[2]])
    }
    i++
  }
  const blocks = []
  let widths = null
  while (i < lines.length) {
    const line = lines[i]
    let m
    if (!line.trim()) { i++; continue }
    if ((m = line.match(/^<!--\s*widths:\s*([\d,\s]+)-->/))) { widths = m[1].split(',').map(Number); i++; continue }
    if (/^<!--\s*pagebreak\s*-->/.test(line)) { blocks.push({ t: 'break' }); i++; continue }
    if (/^<!--/.test(line)) { while (!lines[i].includes('-->')) i++; i++; continue }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { blocks.push({ t: 'h', level: m[1].length, text: m[2], line: i + 1 }); i++; continue }
    if ((m = line.match(/^```(\S*)\s*(.*)$/))) {
      const body = []
      for (i++; !/^```\s*$/.test(lines[i]); i++) {
        if (i >= lines.length) throw new Error(`unclosed code fence at line ${blocks.length}`)
        body.push(lines[i])
      }
      i++
      if (m[1] === 'mermaid') {
        const [num, ...cap] = m[2].split('|')
        blocks.push({ t: 'mermaid', num: num.trim(), caption: cap.join('|').trim(), src: body.join('\n') })
      } else blocks.push({ t: 'code', lines: body })
      continue
    }
    if (line.startsWith('|')) {
      const rows = []
      for (; i < lines.length && lines[i].startsWith('|'); i++) {
        if (/^\|[\s:|-]+\|\s*$/.test(lines[i])) continue
        rows.push(splitRow(lines[i]))
      }
      blocks.push({ t: 'table', rows, widths, line: i })
      widths = null
      continue
    }
    if ((m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/))) {
      const items = []
      for (; i < lines.length; i++) {
        const lm = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
        if (lm) items.push({ level: lm[1].length >= 2 ? 1 : 0, ordered: /\d/.test(lm[2]), text: lm[3] })
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1].text += ' ' + lines[i].trim()
        else break
      }
      blocks.push({ t: 'list', items })
      continue
    }
    if (line.startsWith('>')) {
      const body = []
      for (; i < lines.length && lines[i].startsWith('>'); i++) body.push(lines[i].replace(/^>\s?/, ''))
      blocks.push({ t: 'note', text: body.join(' ') })
      continue
    }
    const para = []
    for (; i < lines.length && lines[i].trim() && !/^(#|```|\||>|<!--|\s*([-*]|\d+\.)\s)/.test(lines[i]); i++) para.push(lines[i].trim())
    blocks.push({ t: 'p', text: para.join(' ') })
  }
  return { meta, blocks }
}

function splitRow(line) {
  const cells = []
  let cur = ''
  let code = false
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (c === '\\' && s[k + 1] === '|') { cur += '|'; k++; continue }
    if (c === '`') code = !code
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  cells.push(cur.trim())
  return cells
}

// ── inline → TextRuns ────────────────────────────────────────────────────────

function runs(text, base = {}) {
  const out = []
  const re = /(\*\*(.+?)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\([^)]+\))/g
  let last = 0
  let m
  const plain = s => s && out.push(new d.TextRun({ text: s.replace(/\\([*`|])/g, '$1'), ...base }))
  while ((m = re.exec(text))) {
    plain(text.slice(last, m.index))
    if (m[2] !== undefined) out.push(...runs(m[2], { ...base, bold: true }))
    else if (m[3] !== undefined) out.push(new d.TextRun({ text: m[3], ...base, font: MONO }))
    else if (m[4] !== undefined) out.push(...runs(m[4], { ...base, italics: true }))
    else out.push(...runs(m[5], base))
    last = re.lastIndex
  }
  plain(text.slice(last))
  return out
}

// ── mermaid → PNG (cached) ───────────────────────────────────────────────────

async function renderDiagrams(blocks) {
  const cache = path.join(os.tmpdir(), 'frd-mermaid')
  fs.mkdirSync(cache, { recursive: true })
  const todo = blocks.filter(b => b.t === 'mermaid')
  for (const b of todo) b.file = path.join(cache, crypto.createHash('sha1').update('r4|' + b.src).digest('hex'))
  const missing = todo.filter(b => !fs.existsSync(b.file + '.png'))
  if (missing.length) {
    const { chromium } = require('playwright-core')
    const browser = await chromium.launch({ executablePath: CHROME })
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })
    await page.setContent('<html><body style="margin:0;background:#fff"><div id="c" style="display:inline-block;padding:8px;background:#fff"></div></body></html>')
    await page.addScriptTag({ url: MERMAID })
    for (const b of missing) {
      const size = await page.evaluate(async src => {
        // Tighter than mermaid's defaults: the page is 6.5" wide, and every pixel of spacing
        // a diagram carries is text shrunk to fit it.
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'Leelawadee UI, Leelawadee, Tahoma, sans-serif',
          sequence: { mirrorActors: false, actorMargin: 24, width: 130, boxMargin: 6, messageMargin: 28, noteMargin: 6 },
          flowchart: { nodeSpacing: 28, rankSpacing: 36, padding: 8 },
          er: { entityPadding: 8 },
        })
        const { svg } = await mermaid.render('m' + Math.random().toString(36).slice(2), src)
        const c = document.getElementById('c')
        c.innerHTML = svg
        // mermaid emits width:100%, which collapses inside the shrink-wrapped container
        const el = c.querySelector('svg')
        const vb = el.viewBox.baseVal
        el.style.maxWidth = 'none'
        el.style.width = vb.width + 'px'
        el.style.height = vb.height + 'px'
        const r = c.getBoundingClientRect()
        return { w: r.width, h: r.height }
      }, b.src).catch(e => { throw new Error(`diagram ${b.num} (${b.caption}): ${e.message}`) })
      await page.locator('#c').screenshot({ path: b.file + '.png' })
      fs.writeFileSync(b.file + '.json', JSON.stringify(size))
    }
    await browser.close()
  }
  for (const b of todo) {
    const { w, h } = JSON.parse(fs.readFileSync(b.file + '.json', 'utf8'))
    const k = Math.min(1, 624 / w, 860 / h) // 6.5" wide, ~9" tall at 96 dpi
    if (k < 0.6) console.warn(`diagram ${b.num} is drawn at ${Math.round(k * 100)}% — its text will be hard to read; split it or use TB`)
    b.png = fs.readFileSync(b.file + '.png')
    b.w = Math.round(w * k)
    b.h = Math.round(h * k)
  }
}

// ── blocks → docx ────────────────────────────────────────────────────────────

const B = { style: d.BorderStyle.SINGLE, size: 4, color: 'auto' }
const P = (children, opts = {}) => new d.Paragraph({ children, ...opts })

function colWidths(rows, pct) {
  const n = rows[0].length
  let w = pct && pct.length === n ? pct : rows[0].map((_, c) => Math.max(4, Math.min(60, ...rows.map(r => (r[c] || '').length))))
  const sum = w.reduce((a, b) => a + b, 0)
  w = w.map(x => Math.max(600, Math.floor((x / sum) * PAGE_W)))
  w[w.length - 1] += PAGE_W - w.reduce((a, b) => a + b, 0)
  return w
}

function cell(text, width, header) {
  const paras = text.split(/<br\s*\/?>/).map(t => P(runs(t, { size: 20, bold: header || undefined }), { spacing: { before: 20, after: 20, line: 240 } }))
  return new d.TableCell({
    width: { size: width, type: d.WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: header ? { fill: 'DCE6F1', type: d.ShadingType.CLEAR, color: 'auto' } : undefined,
    children: paras,
  })
}

function toDocx({ meta, blocks }) {
  const kids = []
  const m = Object.fromEntries(meta)
  kids.push(P([new d.TextRun({ text: m.eyebrow || 'Carmen Cloud ERP', bold: true, color: '6B7280', size: 28 })], { spacing: { before: 500, after: 60 } }))
  kids.push(P([new d.TextRun({ text: m.title, bold: true, color: '1F4E79', size: 38 })], { spacing: { after: 200 } }))
  for (const [k, v] of meta) {
    if (['eyebrow', 'title', 'output', 'check-ignore'].includes(k)) continue
    kids.push(P([new d.TextRun({ text: k + ': ', bold: true }), ...runs(v)], { spacing: { before: 0, after: 120, line: 276 } }))
  }
  kids.push(P([], { spacing: { after: 120 } }))

  let numInstance = 0
  for (const b of blocks) {
    if (b.t === 'h') {
      const heading = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3][b.level - 1]
      const spacing = [{ before: 320, after: 140 }, { before: 260, after: 120 }, { before: 200, after: 100 }][b.level - 1]
      kids.push(P(runs(b.text), { heading, spacing, keepNext: true }))
    } else if (b.t === 'p') {
      kids.push(P(runs(b.text), { spacing: { before: 0, after: 120, line: 276 } }))
    } else if (b.t === 'note') {
      const nm = b.text.match(/^\*\*(.+?)\*\*\s*(.*)$/)
      kids.push(P(nm ? [new d.TextRun({ text: nm[1] + ' ', bold: true }), ...runs(nm[2], { italics: true })] : runs(b.text, { italics: true }), { spacing: { before: 0, after: 120, line: 276 } }))
    } else if (b.t === 'list') {
      const inst = ++numInstance
      for (const it of b.items) {
        kids.push(P(runs(it.text), {
          numbering: { reference: it.ordered ? 'numbers' : 'bullets', level: it.level, instance: it.ordered ? inst : undefined },
          spacing: { after: 60, line: 276 },
        }))
      }
    } else if (b.t === 'code') {
      // A one-cell table, not bordered paragraphs: docx-js writes a paragraph's borders as
      // top/bottom/left/right, the schema wants top/left/bottom/right, and the last line of a
      // block carries both bottom and left.
      const side = { style: d.BorderStyle.SINGLE, size: 6, color: 'D1D5DB' }
      kids.push(new d.Table({
        width: { size: PAGE_W, type: d.WidthType.DXA },
        columnWidths: [PAGE_W],
        borders: { top: side, bottom: side, left: side, right: side, insideHorizontal: side, insideVertical: side },
        rows: [new d.TableRow({ children: [new d.TableCell({
          width: { size: PAGE_W, type: d.WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          shading: { fill: 'F5F5F5', type: d.ShadingType.CLEAR, color: 'auto' },
          children: b.lines.map(ln => P([new d.TextRun({ text: ln || ' ', font: MONO, size: 16, color: '1F2937' })], { spacing: { before: 0, after: 0, line: 240 } })),
        })] })],
      }))
      kids.push(P([], { spacing: { after: 120 } }))
    } else if (b.t === 'table') {
      const widths = colWidths(b.rows, b.widths)
      const n = widths.length
      kids.push(new d.Table({
        width: { size: PAGE_W, type: d.WidthType.DXA },
        columnWidths: widths,
        borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B },
        rows: b.rows.map((r, ri) => new d.TableRow({
          tableHeader: ri === 0,
          children: Array.from({ length: n }, (_, c) => cell(r[c] || '', widths[c], ri === 0)),
        })),
      }))
      kids.push(P([], { spacing: { after: 120 } }))
    } else if (b.t === 'mermaid') {
      kids.push(P([
        new d.TextRun({ text: `Diagram ${b.num}: `, bold: true, color: '6B7280', size: 18 }),
        new d.TextRun({ text: b.caption, italics: true, color: '6B7280', size: 18 }),
      ], { keepNext: true, spacing: { before: 200, after: 60, line: 276 } }))
      // The alt text keeps the mermaid source, as the first FRDs did, so the diagram can
      // always be recovered from the .docx alone.
      kids.push(P([new d.ImageRun({ type: 'png', data: b.png, transformation: { width: b.w, height: b.h }, altText: { name: `diagram_${b.num}`, title: b.caption, description: b.src } })], { spacing: { after: 200 } }))
    } else if (b.t === 'break') {
      kids.push(P([new d.PageBreak()]))
    }
  }

  const head = (id, name, size, color, extra = {}) => ({ id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, bold: true, color, size }, paragraph: extra })
  const lvl = (level, format, text, left) => ({ level, format, text, alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left, hanging: 260 } } } })
  return new d.Document({
    styles: {
      default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        head('Heading1', 'Heading 1', 30, '1F4E79', { outlineLevel: 0 }),
        head('Heading2', 'Heading 2', 25, '1F4E79', { outlineLevel: 1 }),
        head('Heading3', 'Heading 3', 22, '2E74B5', { outlineLevel: 2 }),
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [lvl(0, d.LevelFormat.BULLET, '•', 460), lvl(1, d.LevelFormat.BULLET, '◦', 920)] },
        { reference: 'numbers', levels: [lvl(0, d.LevelFormat.DECIMAL, '%1.', 460), lvl(1, d.LevelFormat.LOWER_LETTER, '%2.', 920)] },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children: kids }],
  })
}

// ── --check: every backticked name must exist in the code ────────────────────

function corpus() {
  const files = execFileSync('git', ['ls-files', 'backend', 'frontend/src', 'supabase', 'scripts', 'contracts'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  const text = files.filter(f => /\.(py|ts|tsx|sql|js|cjs|mjs|json|toml|ya?ml|ps1|css|ini|txt)$/.test(f)).map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  return { files, text }
}

function expand(tok) {
  const m = tok.match(/^(.*)\{([^}]+)\}(.*)$/)
  return m && m[2].includes(',') ? m[2].split(',').flatMap(x => expand(m[1] + x + m[3])) : [tok]
}

function checkToken(tok, { files, text }) {
  // `fn()`, `list[]` and a prefix pattern `AICC*` are checked by their bare name
  let t = tok.replace(/(\(\)|\[\]|\*)$/, '').replace(/\?.*$/, '')
  const verb = t.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/)
  if (verb) t = verb[2]
  if (/\s/.test(t) || /^[{[<\d"'\-+=]/.test(t) || t.includes('=') || t.length < 3) return true // expressions, values, codes
  if (t.startsWith('/') || t.startsWith('#/')) {
    const segs = t.replace(/\?.*$/, '').split('/').filter(s => s && s !== '#' && !/[{}<>:…*]/.test(s) && !['api', 'v1'].includes(s))
    return !segs.length || text.includes('/' + segs[segs.length - 1])
  }
  if (t.includes('/') || /\.(py|tsx?|sql|md|cjs|json|ya?ml)$/.test(t)) {
    const exists = q => files.some(f => f === q || f.endsWith('/' + q) || f.includes('/' + q + '/') || f.startsWith(q + '/')) || fs.existsSync(path.join(ROOT, q))
    return expand(t).every(p => {
      const q = p.replace(/\/\*?$/, '').replace(/^\.\//, '')
      if (exists(q)) return true
      // `pkg/module.func` or `pkg/_SYMBOL`: the module (or package) exists and defines the name
      const mod = q.match(/^(.*)\/(\w+)\.(\w+)$/)
      if (mod && ['py', 'ts', 'tsx'].some(e => exists(`${mod[1]}/${mod[2]}.${e}`))) return text.includes(mod[3])
      const last = q.match(/^(.*)\/(\w+)$/)
      return !!(last && exists(last[1]) && text.includes(last[2]))
    })
  }
  return t.split('.').filter(s => s.length >= 3).every(s => text.includes(s))
}

function check(src, file) {
  const { meta } = parse(src)
  const ignore = new Set((Object.fromEntries(meta)['check-ignore'] || '').split(',').map(s => s.trim()).filter(Boolean))
  const c = corpus()
  const misses = []
  let fence = false
  src.replace(/\r/g, '').split('\n').forEach((line, n) => {
    if (/^```/.test(line)) { fence = !fence; return }
    if (fence) return
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      if (!ignore.has(m[1]) && !checkToken(m[1], c)) misses.push(`${file}:${n + 1}  \`${m[1]}\``)
    }
  })
  return misses
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.'
  const files = args.filter((a, k) => a.endsWith('.md') && args[k - 1] !== '--out')
  let failed = false
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    const misses = check(src, path.relative(ROOT, path.resolve(f)))
    if (misses.length) { failed = true; console.error(`not found in code (${misses.length}):\n  ` + misses.join('\n  ')) }
    if (args.includes('--check')) continue
    const doc = parse(src)
    await renderDiagrams(doc.blocks)
    const name = Object.fromEntries(doc.meta).output || path.basename(f, '.md') + '.docx'
    fs.mkdirSync(out, { recursive: true })
    fs.writeFileSync(path.join(out, name), await d.Packer.toBuffer(toDocx(doc)))
    console.log('wrote', path.join(out, name))
  }
  process.exit(failed ? 1 : 0)
}

main().catch(e => { console.error(e.message); process.exit(2) })
