import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  devtools: {
    // Remove this `apply` property to enable devtools for build as well
    apply: 'serve',
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
