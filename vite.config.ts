import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Precache everything the built app needs so it works with no connection
      // after the first load — no server, no API, matches the rest of the project.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
      manifest: {
        name: 'OpenRF — Patch Antenna Synthesis',
        short_name: 'OpenRF',
        description:
          'Microstrip patch antenna synthesis and tradeoff analysis — transmission-line model, entirely client-side.',
        start_url: './',
        display: 'standalone',
        background_color: '#17181a',
        theme_color: '#17181a',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
