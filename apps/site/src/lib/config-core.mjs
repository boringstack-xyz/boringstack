// Build-time configuration for the public site. Plain JavaScript so that
// astro.config.mjs, the nginx renderer and the tests share one implementation.
//
// Every value is validated here. Astro loads this file before it renders
// anything, so an invalid value fails `astro build` (and therefore
// `docker build`) rather than publishing pages with a broken origin, an
// empty contact address, or an analytics script nobody can audit.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANALYTICS_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class SiteConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "SiteConfigError";
  }
}

/**
 * Parse an origin-only URL such as https://example.com. Paths, queries,
 * fragments and credentials are rejected because every generated URL is built
 * from the origin.
 */
function parseOrigin(name, raw) {
  const value = (raw ?? "").trim();
  if (!value) {
    throw new SiteConfigError(
      `${name} is required, for example https://example.com`,
    );
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SiteConfigError(
      `${name} must be an absolute URL, got "${value}"`,
    );
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SiteConfigError(`${name} must use http or https`);
  }
  if (url.username || url.password) {
    throw new SiteConfigError(`${name} must not contain credentials`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new SiteConfigError(
      `${name} must be an origin without a path, query or fragment`,
    );
  }
  return url;
}

/**
 * Resolve and validate the site configuration from an environment object.
 * Returns a frozen object; throws SiteConfigError on the first problem found.
 */
export function resolveSiteConfig(env = {}) {
  const site = parseOrigin("SITE_URL", env.SITE_URL);
  const app = parseOrigin("APP_URL", env.APP_URL);
  const local = LOCAL_HOSTS.has(site.hostname);

  if (!local && site.protocol !== "https:") {
    throw new SiteConfigError(
      `SITE_URL must use https outside localhost, got ${site.origin}`,
    );
  }
  if (!LOCAL_HOSTS.has(app.hostname) && app.protocol !== "https:") {
    throw new SiteConfigError(
      `APP_URL must use https outside localhost, got ${app.origin}`,
    );
  }
  // The public site and the authenticated app are split by host. Sharing an
  // origin would let public pages and app pages share cookies and indexing.
  if (site.origin === app.origin) {
    throw new SiteConfigError(
      "APP_URL must be a different origin from SITE_URL: the public site and the app run on separate hosts",
    );
  }

  const contactEmail = (env.CONTACT_EMAIL ?? "").trim();
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    throw new SiteConfigError("CONTACT_EMAIL must be an email address");
  }
  if (!local && !contactEmail) {
    throw new SiteConfigError(
      `CONTACT_EMAIL is required for a public-origin build (SITE_URL=${site.origin}). Set it to a mailbox you monitor.`,
    );
  }

  const scriptUrl = (env.ANALYTICS_SCRIPT_URL ?? "").trim();
  const websiteId = (env.ANALYTICS_WEBSITE_ID ?? "").trim();
  if (Boolean(scriptUrl) !== Boolean(websiteId)) {
    throw new SiteConfigError(
      "ANALYTICS_SCRIPT_URL and ANALYTICS_WEBSITE_ID must be set together, or both left empty",
    );
  }
  let analytics = null;
  if (scriptUrl) {
    let script;
    try {
      script = new URL(scriptUrl);
    } catch {
      throw new SiteConfigError("ANALYTICS_SCRIPT_URL must be an absolute URL");
    }
    if (script.protocol !== "https:") {
      throw new SiteConfigError("ANALYTICS_SCRIPT_URL must use https");
    }
    if (script.username || script.password || script.hash) {
      throw new SiteConfigError(
        "ANALYTICS_SCRIPT_URL must not contain credentials or a fragment",
      );
    }
    if (!ANALYTICS_ID_PATTERN.test(websiteId)) {
      throw new SiteConfigError(
        "ANALYTICS_WEBSITE_ID must be 1-64 letters, digits, hyphens or underscores",
      );
    }
    analytics = Object.freeze({
      scriptUrl: script.href,
      origin: script.origin,
      websiteId,
    });
  }

  return Object.freeze({
    siteUrl: site.origin,
    appUrl: app.origin,
    contactEmail,
    // Local builds stay out of search indexes. Public origins are indexable.
    indexable: !local,
    analytics,
  });
}

/**
 * Content-Security-Policy for the nginx container. The site ships no inline
 * script or style, so 'self' covers everything except the optional analytics
 * script, which is allowed by its exact origin and nothing else.
 */
export function buildCsp(config) {
  const analyticsOrigin = config.analytics ? ` ${config.analytics.origin}` : "";
  return [
    "default-src 'self'",
    `script-src 'self'${analyticsOrigin}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${analyticsOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
