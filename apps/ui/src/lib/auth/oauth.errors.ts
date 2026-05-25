import { KNOWN_OAUTH_ERRORS } from "./oauth.errors.constants";

export function resolveOAuthErrorMessage(
  error: string,
  t: (key: string) => string
): string {
  const normalized = error.trim().toLowerCase();

  if (normalized === "") {
    return t("auth.oauth.failed.errors.unknown");
  }

  if (KNOWN_OAUTH_ERRORS.has(normalized)) {
    return t(`auth.oauth.failed.errors.${normalized}`);
  }

  return t("auth.oauth.failed.errors.unknown");
}
