/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // push game-night fixes to phones instead of leaving them on the old version
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stack',
        short_name: 'Stack',
        description: 'Poker night buy-ins, settle-up and leaderboard',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
