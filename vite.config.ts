import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ITS 부대행사 자원봉사 운영',
        short_name: 'ITS 봉사운영',
        theme_color: '#1d4ed8',
        background_color: '#0f172a',
        display: 'standalone',
        lang: 'ko',
      },
    }),
  ],
})
