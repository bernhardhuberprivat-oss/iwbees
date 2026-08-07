import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

// mode "native" wird für den Capacitor/iOS-Build verwendet (npm run build:native),
// mode "production"/"development" für den normalen Web-Build (iwbees.netlify.app).
export default defineConfig(({ mode }) => {
  const isNative = mode === "native";

  return {
    plugins: [
      react(),
      // Der Netlify-Plugin simuliert Functions/DB nur für den lokalen Web-Dev-Server -
      // im nativen Build läuft das Frontend gegen die echte, remote gehostete API.
      ...(isNative ? [] : [netlify()]),
      // Der native Build braucht keinen Service Worker/PWA-Installbanner - Offline-Support
      // läuft dort über die eigene IndexedDB-Warteschlange (src/offline.ts).
      ...(isNative
        ? []
        : [
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
          ]),
    ],
    build: {
      outDir: isNative ? "dist-native" : "dist",
    },
  };
});
