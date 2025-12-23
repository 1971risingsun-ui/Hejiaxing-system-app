
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: '合家興 AI - 智慧建築專案管理',
          short_name: '合家興 AI',
          description: '智慧建築專案管理與 AI 施工分析系統',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/Hejiaxing-system-app/',
          start_url: '/Hejiaxing-system-app/',
          icons: [
            {
              src: 'https://ui-avatars.com/api/?name=HJX&background=0f172a&color=fff&size=192',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://ui-avatars.com/api/?name=HJX&background=0f172a&color=fff&size=512',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'https://ui-avatars.com/api/?name=HJX&background=0f172a&color=fff&size=512',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'tailwind-cdn',
                expiration: {
                  maxEntries: 1,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
                },
              },
            },
            {
                urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'external-libs'
                }
            }
          ]
        }
      })
    ],
    base: '/Hejiaxing-system-app/',
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
