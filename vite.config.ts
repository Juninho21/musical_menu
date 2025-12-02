import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api/mercadopago': {
        target: 'https://api.mercadopago.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mercadopago/, '')
      }
    }
  }
})
