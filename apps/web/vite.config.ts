import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defaultClientConditions, defineConfig } from "vite"

// The dev server proxies /api to the local API so the browser stays same-origin and the
// client can use relative URLs in every environment.
const API_TARGET = process.env.CLASP_API_URL ?? "http://localhost:3001"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    // Read workspace packages from their TypeScript sources (CLAUDE.md, section 5).
    conditions: ["@clasp/source", ...defaultClientConditions],
  },
  build: {
    rolldownOptions: {
      output: {
        // Pages are split per route (app-routes.tsx). Libraries get stable, named chunks on top,
        // so a release that only changes app code leaves the browser's cached vendors valid.
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-react-aria",
              test: /node_modules[\\/](react-aria|react-aria-components|react-stately|@react-aria|@react-stately|@react-types|@internationalized)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor-query",
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 20,
            },
            { name: "vendor-zod", test: /node_modules[\\/]zod[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
})
