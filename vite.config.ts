import { crx } from "@crxjs/vite-plugin"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import manifest from "./manifest.json"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({
      manifest,
      contentScripts: {
        standaloneFiles: ["src/content/index.ts"],
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
})
