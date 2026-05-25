import { z } from "zod";

import type { IEnv } from "./env.types";
import { envSchema } from "./schema";

export function loadEnv(): IEnv {
  const raw = import.meta.env;
  const parsed = envSchema.safeParse({
    VITE_APP_NAME: raw.VITE_APP_NAME,
    VITE_API_URL: raw.VITE_API_URL,
    VITE_PUBLIC_URL: raw.VITE_PUBLIC_URL,
    VITE_SENTRY_DSN: raw.VITE_SENTRY_DSN,
    VITE_AUTH_NAMESPACE: raw.VITE_AUTH_NAMESPACE,
    VITE_VAPID_PUBLIC_KEY: raw.VITE_VAPID_PUBLIC_KEY,
    VITE_LOCALES: raw.VITE_LOCALES,
    MODE: raw.MODE,
    DEV: raw.DEV,
    PROD: raw.PROD
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(
        z.treeifyError(parsed.error),
        null,
        2
      )}`
    );
  }

  return parsed.data;
}
