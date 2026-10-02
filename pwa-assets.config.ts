import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// regenerate the app icons from public/logo.svg with: npm run icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // the logo already has its own dark rounded background
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#0f172a' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#0f172a' } },
  },
  images: ['public/logo.svg'],
})
