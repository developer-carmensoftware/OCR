import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

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
