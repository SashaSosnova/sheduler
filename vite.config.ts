import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PWA plugin intentionally omitted for Android APK builds —
// home-garden installs cleanly without it; VitePWA bloated the APK
// with service-worker assets that are unnecessary in Capacitor.
export default defineConfig({
  base: './',
  server: {
    host: true,
    watch: {
      ignored: ['**/tmp-apk/**', '**/android/**'],
    },
  },
  build: {
    outDir: 'dist',
  },
  plugins: [react()],
})
