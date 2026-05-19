import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'framer': ['framer-motion'],
                    'ui': ['lucide-react', 'sonner'],
                },
            },
        },
    },
});
