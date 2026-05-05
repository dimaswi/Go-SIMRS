import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 550,
    // Use default chunk splitting to avoid runtime module init-order issues.
  },
  server: {
    allowedHosts: ['bpjs_dev.dimaswysnu.com', 'localhost'],
  },
})
