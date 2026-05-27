import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { type PluginOption, defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char] ?? char;
  });

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;

  return `${(bytes / 1024).toFixed(2)} kB`;
};

const toSourceString = (source: string | Uint8Array): string =>
  typeof source === "string" ? source : Buffer.from(source).toString("utf8");

const bundleStatsPlugin = (): PluginOption => ({
  name: "boringstack-bundle-stats",
  generateBundle(_options, bundle) {
    const assets = Object.entries(bundle)
      .map(([fileName, output]) => {
        const source =
          output.type === "chunk" ? output.code : toSourceString(output.source);
        const bytes = Buffer.byteLength(source, "utf8");

        return {
          bytes,
          brotliBytes: brotliCompressSync(source).byteLength,
          fileName,
          gzipBytes: gzipSync(source).byteLength,
          kind: output.type
        };
      })
      .sort((a, b) => b.bytes - a.bytes);
    const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
    const rows = assets
      .map(
        (asset) => `
          <tr>
            <td>${escapeHtml(asset.fileName)}</td>
            <td>${escapeHtml(asset.kind)}</td>
            <td>${formatBytes(asset.bytes)}</td>
            <td>${formatBytes(asset.gzipBytes)}</td>
            <td>${formatBytes(asset.brotliBytes)}</td>
          </tr>`
      )
      .join("");
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BoringStack bundle stats</title>
    <style>
      body { color: #101828; font-family: Inter, ui-sans-serif, system-ui, sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #eaecf0; padding: 0.625rem 0.75rem; text-align: left; }
      th { background: #f9fafb; font-size: 0.8125rem; text-transform: uppercase; }
      td:nth-child(n + 3) { font-variant-numeric: tabular-nums; white-space: nowrap; }
    </style>
  </head>
  <body>
    <h1>BoringStack bundle stats</h1>
    <p>${assets.length} emitted assets, ${formatBytes(totalBytes)} raw total.</p>
    <table>
      <thead>
        <tr>
          <th>Asset</th>
          <th>Type</th>
          <th>Raw</th>
          <th>Gzip</th>
          <th>Brotli</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

    this.emitFile({
      fileName: "stats.html",
      source: html,
      type: "asset"
    });
  }
});

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
        : "http://localhost:7330";

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

  return {
    plugins: [
      tailwindcss(),
      react(),
      svgr(),
      process.env.ANALYZE === "true" ? bundleStatsPlugin() : null,
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
      port: 7331,
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
      port: 7331
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
