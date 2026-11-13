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
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
})
