import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

function hasAny(id: string, parts: string[]): boolean {
  return parts.some((part) => id.includes(part))
}

function manualChunkForDependency(id: string): string | undefined {
  if (id.includes("fabric")) return "canvas"
  if (id.includes("fuse.js")) return "search"
  if (
    hasAny(id, [
      "react-joyride",
      "@gilbarbara",
      "@fastify/deepmerge",
      "react-innertext",
      "/node_modules/scroll/",
      "/node_modules/scrollparent/",
      "/node_modules/is-lite/",
    ])
  ) {
    return "tour"
  }
  if (id.includes("lucide-react")) return "icons"
  if (id.includes("@radix-ui/react-dialog")) return "dialog"
  if (hasAny(id, ["@radix-ui", "radix-ui", "cmdk"])) return "ui"
  if (
    hasAny(id, [
      "/node_modules/react/",
      "/node_modules/react-dom/",
      "/node_modules/scheduler/",
    ])
  ) {
    return "react"
  }
  if (id.includes("/node_modules/@supabase/")) return "supabase"
  if (id.includes("/node_modules/@tauri-apps/")) return "tauri"
  if (id.includes("/node_modules/zustand/")) return "state"
  return "vendor"
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: "build",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        broadcast: path.resolve(__dirname, "broadcast-output.html"),
      },
      onwarn(warning, warn) {
        if (warning.code === "PLUGIN_TIMINGS") return
        warn(warning)
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/")
          if (!normalizedId.includes("node_modules")) return
          return manualChunkForDependency(normalizedId)
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
