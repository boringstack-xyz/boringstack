import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { loadEnv } from "vite";
import { resolveSiteConfig } from "./src/lib/config-core.mjs";

// Validation happens here, before any page renders. A bad value throws and the
// build exits non-zero. The result is also exposed to pages as the global
// __SITE_CONFIG__ (see src/lib/site-config.ts), so pages and config never drift.
const env = {
  ...loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), ""),
  ...process.env,
};
const config = resolveSiteConfig(env);

export default defineConfig({
  site: config.siteUrl,
  output: "static",
  // Canonical URLs are slashless. nginx redirects trailing-slash variants.
  trailingSlash: "never",
  build: {
    format: "file",
    // Keep styles in external files so the CSP can forbid inline styles.
    inlineStylesheets: "never",
  },
  server: {
    host: process.env.HOST ?? "127.0.0.1",
    port: 7333,
  },
  integrations: [
    sitemap({
      // Error pages and image endpoints are not indexable documents.
      filter: (page) => !/\/(404|og)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
  vite: {
    define: {
      __SITE_CONFIG__: JSON.stringify(config),
    },
  },
});
