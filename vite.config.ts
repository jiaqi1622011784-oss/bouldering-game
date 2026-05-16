import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/bouldering-game/',
  server: {
    host: true,
    port: 3000
  }
})
