import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Pin the clock's timezone before anything constructs a Date.
//
// The suite used to inherit the machine's, so date-dependent tests ran in ICT on a
// developer's laptop and UTC in CI — the same assertion could pass locally and fail on
// the PR, which is exactly what happened to PeriodPicker's `today()`. Asia/Bangkok
// rather than UTC because that is the offset the product actually runs at: every user
// is Thai, and a helper that reads the *local* date is only meaningfully exercised
// where local and UTC disagree. Under UTC that whole class of bug is untestable.
process.env.TZ = 'Asia/Bangkok'

export default defineConfig({
  plugins: [react()],
  // Mirrors vite.config.ts — this config is separate, so the define has to be too
  // or anything rendering __APP_VERSION__ blows up only under test.
  define: {
    __APP_VERSION__: JSON.stringify(
      readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim()
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/hooks/**', 'src/lib/**'],
    },
  },
})
