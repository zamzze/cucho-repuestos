import {
  defineConfig,
} from 'vite'

import react from '@vitejs/plugin-react'

import {
  VitePWA,
} from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType:
        'autoUpdate',

      includeAssets: [
        'sql-wasm.wasm',
        'data/mpc.db',
        'data/catalog-version.json',
      ],

      manifest: {
        name:
          'MPC Repuestos',

        short_name:
          'MPC',

        description:
          'Catálogo de repuestos de Mecatrónica',

        start_url: '/',

        display:
          'standalone',

        background_color:
          '#f8fafc',

        theme_color:
          '#17365d',
      },

      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webmanifest,wasm,db,json}',
        ],

        cleanupOutdatedCaches:
          true,
      },
    }),
  ],
})