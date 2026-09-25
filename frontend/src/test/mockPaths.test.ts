/**
 * Every `vi.mock('<relative path>')` in the suite must resolve to a real file.
 *
 * Vitest does not error on a wrong mock path — if the spec a mock names does not
 * resolve, it silently falls through to the REAL module instead of the mock, so the
 * test keeps "passing" while quietly exercising un-mocked code. That is exactly the
 * failure mode a folder move (Phase 4 of the refactor) risks on every relative
 * `../../lib/api/...`-style mock: `git mv` updates the file tree, but a `vi.mock()`
 * string is just a string, invisible to `tsc` and to eslint's import rules alike.
 *
 * This scans every test file's raw source (without executing it, so none of its own
 * mocks or side effects run) for `vi.mock('spec', ...)` calls and checks each
 * relative spec against the project's real file tree.
 */
import { describe, expect, it } from 'vitest'

// Every test file's source, as text — read via Vite's glob rather than node:fs so this
// works the same way in any environment vitest runs under.
const TEST_SOURCES = import.meta.glob('/src/**/*.test.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Every real source file a mock could plausibly point at, as the set of glob keys
// (project-root-relative paths, e.g. '/src/lib/api/config.ts').
const REAL_PATHS = new Set(Object.keys(import.meta.glob('/src/**/*.{ts,tsx}', { eager: false })))

const MOCK_CALL = /\bvi\.mock\(\s*(['"])(.+?)\1/g

/** Collapse a relative spec against the mocking file's own directory, filesystem-path style. */
function resolveSpec(fromFile: string, spec: string): string {
  const dir = fromFile.slice(0, fromFile.lastIndexOf('/'))
  const parts = dir.split('/').concat(spec.split('/'))
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return '/' + out.join('/')
}

/** A mock can name a barrel directory or omit the extension — vi.mock() resolves both. */
function existsAsModule(path: string): boolean {
  return (
    REAL_PATHS.has(path) ||
    REAL_PATHS.has(`${path}.ts`) ||
    REAL_PATHS.has(`${path}.tsx`) ||
    REAL_PATHS.has(`${path}/index.ts`) ||
    REAL_PATHS.has(`${path}/index.tsx`)
  )
}

const mockCases = Object.entries(TEST_SOURCES).flatMap(([file, src]) =>
  [...src.matchAll(MOCK_CALL)]
    .map(m => m[2])
    // Bare specifiers (npm packages, e.g. 'sonner') resolve through node_modules, not
    // the project tree — nothing here to check.
    .filter(spec => spec.startsWith('.'))
    .map(spec => ({ file, spec, resolved: resolveSpec(file, spec) }))
)

describe('every vi.mock() relative path resolves to a real file', () => {
  it('found vi.mock() calls to check (sanity: this scan is not accidentally empty)', () => {
    expect(mockCases.length).toBeGreaterThan(10)
  })

  it.each(mockCases)('$file mocks "$spec"', ({ resolved, spec, file }) => {
    expect(
      existsAsModule(resolved),
      `${file} does something like vi.mock('${spec}'), which resolves to ${resolved} — ` +
        'no such file. Vitest silently uses the REAL module in this case instead of the ' +
        'mock, so the test may still be green while testing the wrong thing. Fix the ' +
        'mock path (likely stale after a file move).'
    ).toBe(true)
  })
})
