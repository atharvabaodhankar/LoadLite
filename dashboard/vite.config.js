import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/target': {
        target: 'http://44.200.70.13:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/target/, '')
      }
    }
  }
})
