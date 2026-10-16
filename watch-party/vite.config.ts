import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";

// Standalone Vite config for TanStack Start.
//
// Deployment target: Nitro auto-detects Vercel / Netlify / Cloudflare when
// building on those platforms. Everywhere else it builds a Node server into
// `.output/` (run it with `node .output/server/index.mjs`).
// To force a target, set NITRO_PRESET (e.g. `NITRO_PRESET=vercel npm run build`).
export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Use src/server.ts (SSR error wrapper) as the server entry.
      server: { entry: "server" },
    }),
    // Nitro only runs for production builds.
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
}));
