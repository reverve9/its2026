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
        name: 'ITS 부대행사 현장 운영',
        short_name: 'ITS 현장',
        theme_color: '#234d49', // 틸그린 v3 primary-700 (사이드바·현장 헤더와 일치)
        background_color: '#f6f7f7', // page
        display: 'standalone',
        lang: 'ko',
      },
    }),
  ],
})
