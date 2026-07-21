import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
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
