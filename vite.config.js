import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', allowedHosts: true },
  build: {
    rollupOptions: {
      output: { manualChunks: { vue: ['vue'], database: ['dexie', '@supabase/supabase-js'], dates: ['date-fns'] } }
    }
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Momentum — персональная система действий',
        short_name: 'Momentum',
        description: 'Задачи, связанные цепочки, привычки и тренировки в одном фокусе',
        theme_color: '#0a0c10',
        background_color: '#0a0c10',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'ru',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ],
        shortcuts: [
          { name: 'План на сегодня', short_name: 'Сегодня', url: './?view=today', icons: [{ src: 'icon-192.png', sizes: '192x192' }] }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] }
    })
  ]
})
