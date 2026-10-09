import type { SiteConfig } from "./config-core.mjs";

export type { SiteConfig, AnalyticsConfig } from "./config-core.mjs";

/** Validated at build time by astro.config.mjs; never re-parsed in pages. */
export const siteConfig: SiteConfig = __SITE_CONFIG__;

/** Absolute URL of a path on the public site. Paths are slashless. */
export function siteHref(path: string): string {
  return new URL(path, `${siteConfig.siteUrl}/`).href;
}

/** Absolute URL of a path on the app origin, for sign-up and sign-in links. */
export function appHref(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error(`Invalid app path: ${path}`);
  }
  return new URL(path, `${siteConfig.appUrl}/`).href;
}
