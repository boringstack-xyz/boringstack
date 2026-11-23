/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/*
 * The dashboard is same-origin with the admin API: in dev, /api is proxied to
 * the LAN-only admin process on loopback. Nothing here is reachable from the
 * public internet; the Compose and k3s targets put it behind the LAN only.
 */
const ADMIN_API_TARGET =
  process.env.ADMIN_API_TARGET ?? "http://127.0.0.1:7340";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 7341,
    strictPort: true,
    proxy: {
      "/api": { target: ADMIN_API_TARGET, changeOrigin: false },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
