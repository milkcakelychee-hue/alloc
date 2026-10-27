/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // ควบคุมการรีเฟรชเองใน src/lib/update.ts
      injectRegister: null,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Alloc',
        short_name: 'Alloc',
        description: 'Alloc — วางแผนเงินเดือนให้ทุกบาทมีหน้าที่ ข้อมูลอยู่ในเครื่องเท่านั้น',
        lang: 'th',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#1E3B2C',
        theme_color: '#1E3B2C',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'CacheFirst', options: { cacheName: 'fonts', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 30, maxAgeSeconds: 31536000 } } }
        ]
      }
    })
  ],
  test: {
    include: ['src/**/*.test.ts']
  }
});
