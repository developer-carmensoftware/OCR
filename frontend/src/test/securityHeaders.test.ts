// The headers Vercel serves (vercel.json) against the page they protect (index.html).
//
// The CSP allows index.html's one inline script by its sha256. Editing that script without
// updating the hash would get it refused once the CSP is enforced (it is Report-Only until
// then) — the theme flash comes back and nobody connects it to a header. This test is what
// connects them.
//
// Both files are read through Vite (`?raw`), not node:fs, as mockPaths.test.ts does.
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import vercelJson from '../../vercel.json?raw'

const config = JSON.parse(vercelJson) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const headers = Object.fromEntries(
  config.headers.find(h => h.source === '/(.*)')!.headers.map(h => [h.key, h.value])
)
const csp = headers['Content-Security-Policy-Report-Only'] ?? headers['Content-Security-Policy']

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

describe('security headers', () => {
  it('allow every inline script in index.html by its exact hash, and nothing inline besides', async () => {
    // Parsed, not regex-matched: any inline script — whatever its attributes or case — needs
    // a hash; a script with `src` falls under script-src 'self' instead. A script element's
    // textContent is its raw text, exactly what the browser hashes.
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const scripts = [...doc.querySelectorAll('script:not([src])')].map(s => s.textContent ?? '')
    expect(scripts.length).toBeGreaterThan(0)
    for (const body of scripts) {
      expect(csp).toContain(`'sha256-${await sha256(body)}'`)
    }
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  })

  it('refuse to be framed, by any site', () => {
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('send the headers that need no policy decision', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d+/)
  })
})
