import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    netlify(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      includeAssets: ["apple-touch-icon.png", "favicon-32.png", "icon-192.png", "icon-512.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/api/entries",
            handler: "NetworkFirst",
            options: {
              cacheName: "api-entries",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname === "/api/hive-colors",
            handler: "NetworkFirst",
            options: {
              cacheName: "api-hive-colors",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname === "/api/photo",
            handler: "CacheFirst",
            options: {
              cacheName: "api-photos",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
