import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth for the app version — the same repo-root file the backend
// reads in config.py. Baked in at build time; there is no runtime fetch for it.
const appVersion = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim()

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 3010,
    proxy: {
      '/api': 'http://localhost:8010',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion')) return 'framer'
          if (id.includes('lucide-react')) return 'lucide'
          if (id.includes('sonner')) return 'sonner'
          if (id.includes('recharts')) return 'recharts'
          if (id.includes('pdf-lib')) return 'pdf-lib'
          if (id.includes('react')) return 'react-vendor'
        },
      },
    },
  },
})
