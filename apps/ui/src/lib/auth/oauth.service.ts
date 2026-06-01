import { env } from "@/lib/env";
import { logger } from "@/lib/logger/logger";

import type { IOAuthProvider } from "./oauth.types";

export function getOAuthStartUrl(provider: IOAuthProvider): string {
  const baseUrl = env.VITE_API_URL.replace(/\/$/, "");

  return `${baseUrl}/api/v1/auth/oauth/${provider}`;
}

export function startOAuth(provider: IOAuthProvider): void {
  logger.info({ event: "oauth.start", provider });
  window.location.assign(getOAuthStartUrl(provider));
}

export type { IOAuthProvider } from "./oauth.types";
