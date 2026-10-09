/**
 * Canonical path for a route: slashless, with `/` only for the home page.
 * Mirrors the nginx redirects so the canonical URL is always a served URL.
 */
export function canonicalPath(pathname: string): string {
  const withoutIndex = pathname
    .replace(/\/index\.html$/, "/")
    .replace(/\.html$/, "");
  const trimmed = withoutIndex.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * Serialise structured data for a `<script type="application/ld+json">` block.
 * `<` is escaped so no value can close the script element early.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
