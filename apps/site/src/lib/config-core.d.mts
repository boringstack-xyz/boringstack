export interface AnalyticsConfig {
  /** Absolute https URL of the analytics script. */
  readonly scriptUrl: string;
  /** Origin of scriptUrl, allowed in the Content-Security-Policy. */
  readonly origin: string;
  readonly websiteId: string;
}

export interface SiteConfig {
  /** Public origin, without a trailing slash. */
  readonly siteUrl: string;
  /** Origin of the authenticated app. */
  readonly appUrl: string;
  /** Empty only for local builds. */
  readonly contactEmail: string;
  /** False for localhost builds: they get noindex and disallow robots. */
  readonly indexable: boolean;
  readonly analytics: AnalyticsConfig | null;
}

export class SiteConfigError extends Error {}

export function resolveSiteConfig(
  env?: Record<string, string | undefined>,
): SiteConfig;

export function buildCsp(config: SiteConfig): string;
