import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Browser URL (cross-origin) vs. dev-server proxy target are deliberately
  // separate: in same-origin mode VITE_API_URL is empty (browser uses
  // relative paths) while the Vite dev server still needs a concrete target
  // to forward /api to — that's VITE_API_PROXY_TARGET.
  const proxyTarget =
    env.VITE_API_PROXY_TARGET !== undefined && env.VITE_API_PROXY_TARGET !== ""
      ? env.VITE_API_PROXY_TARGET
      : env.VITE_API_URL !== undefined && env.VITE_API_URL !== ""
        ? env.VITE_API_URL
        : "http://localhost:3000";

  // Sentry source-map upload runs only when explicitly enabled in CI and all
  // three secrets are present. Local machines often have Sentry env vars set
  // for other projects; we do not let that accidentally slow or soften builds.
  const isCi = process.env.CI === "true";
  const shouldUploadSourcemaps =
    isCi || process.env.SENTRY_UPLOAD_SOURCE_MAPS === "true";
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? "";
  const sentryOrg = process.env.SENTRY_ORG ?? "";
  const sentryProject = process.env.SENTRY_PROJECT ?? "";
  const sentryRelease = process.env.SENTRY_RELEASE ?? process.env.GITHUB_SHA;
  const sentryUploadEnabled =
    shouldUploadSourcemaps &&
    sentryAuthToken !== "" &&
    sentryOrg !== "" &&
    sentryProject !== "";

  // Bundle analyzer — opt in with `ANALYZE=true pnpm build` to write a
  // sunburst HTML of every chunk's contents to `dist/stats.html`.
  const analyze = process.env.ANALYZE === "true";

  return {
    plugins: [
      tailwindcss(),
      react(),
      svgr(),
      analyze
        ? visualizer({
            filename: "dist/stats.html",
            template: "sunburst",
            gzipSize: true,
            brotliSize: true,
            open: false
          })
        : null,
      // Last in the plugin list (Sentry docs requirement).
      sentryUploadEnabled
        ? sentryVitePlugin({
            org: sentryOrg,
            project: sentryProject,
            authToken: sentryAuthToken,
            release:
              sentryRelease !== undefined && sentryRelease !== ""
                ? { name: sentryRelease, inject: true }
                : undefined,
            sourcemaps: {
              filesToDeleteAfterUpload: ["dist/**/*.map"]
            },
            telemetry: false
          })
        : null
    ],
    resolve: {
      tsconfigPaths: true
    },
    server: {
      // Bind to every interface so the dev server is reachable from outside
      // a Docker container as well as from the host.
      host: true,
      port: 3001,
      strictPort: true,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true
        }
      }
    },
    preview: {
      port: 3001
    },
    build: {
      target: "es2023",
      // Generated only when Sentry upload is enabled; the plugin deletes the
      // files post-upload (filesToDeleteAfterUpload), so users never see them.
      sourcemap: sentryUploadEnabled ? "hidden" : false,
      minify: "esbuild",
      cssMinify: true,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string): string | undefined {
            if (id.includes("node_modules/react-router")) return "router";
            if (id.includes("node_modules/@tanstack/react-query")) {
              return "query";
            }
            if (
              id.includes("node_modules/react-i18next") ||
              id.includes("node_modules/i18next")
            ) {
              return "i18n";
            }
            if (
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react/")
            ) {
              return "react";
            }
            return undefined;
          }
        }
      }
    }
    // No explicit minifier options: Vite 8 uses oxc by default, and the
    // `no-console` lint rule already prevents `console.*` from reaching
    // source code (see eslint.config.mjs) — so we don't need a build-time
    // drop step. Keep this config small.
  };
});
