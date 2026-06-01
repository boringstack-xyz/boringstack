import { PUBLIC_EMAIL_DOMAINS } from "./public-domains";

/**
 * Lowercases + strips the trailing dot a fully-qualified domain name
 * may carry, then returns the part after the `@`. Returns `null` when
 * the input doesn't have exactly one `@` or the local-part/domain is
 * empty — `null` is the explicit "this email can't be domain-scoped"
 * signal so callers don't have to repeat the parsing rules.
 */
export const extractDomain = (email: string): string | null => {
  const trimmed = email.trim();

  if (trimmed === "") {
    return null;
  }

  const at = trimmed.indexOf("@");

  if (at === -1 || at === 0 || at === trimmed.length - 1) {
    return null;
  }

  if (trimmed.slice(at + 1).includes("@")) {
    return null;
  }

  const domain = trimmed.slice(at + 1).toLowerCase();

  return domain.endsWith(".") ? domain.slice(0, -1) : domain;
};

/**
 * Returns true when the domain belongs to the public-email allowlist.
 * Comparison is case-insensitive; the allowlist is stored
 * lowercase-only so the input is normalized before lookup.
 */
export const isPublicEmailDomain = (domain: string): boolean =>
  PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase());
