import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Optional: with VITE_API_BASE=/api the frontend calls the backend through this proxy
    // (same origin, so no CORS). By default the frontend calls http://localhost:5000/api directly.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
