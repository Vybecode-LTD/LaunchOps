import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // LAUNCHOPS_API_URL (e.g. in frontend/.env.local) points the dev proxy at a backend on another port.
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.LAUNCHOPS_API_URL || "http://localhost:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: "dist",
      // The entry chunk (React, router, Radix, shell) is ~535 kB / 167 kB gzipped; heavier
      // pages load lazily. Warn only if it grows past that.
      chunkSizeWarningLimit: 600,
    },
  };
});
