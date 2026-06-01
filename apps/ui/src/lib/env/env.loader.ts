import { z } from "zod";

import type { IEnv } from "./env.types";
import { envSchema } from "./schema";

/*
 * Docker build args bake VITE_* values into the bundle. When a build arg is
 * omitted the ARG default in `Dockerfile.prod` is the empty string, which
 * `import.meta.env.VITE_*` faithfully surfaces as `""`. For schemas that
 * require a non-empty URL (`VITE_PUBLIC_URL`) this would fail validation
 * instead of falling back to the schema default. Treat empty as "not set"
 * for fields where empty is not a sentinel.
 *
 * `VITE_API_URL` keeps `""` as the same-origin sentinel and goes through
 * unchanged.
 */
const emptyToUndefined = (value: unknown): unknown =>
  value === "" ? undefined : value;

export function loadEnv(): IEnv {
  const raw = import.meta.env;
  const parsed = envSchema.safeParse({
    VITE_APP_NAME: emptyToUndefined(raw.VITE_APP_NAME),
    VITE_API_URL: raw.VITE_API_URL,
    VITE_PUBLIC_URL: emptyToUndefined(raw.VITE_PUBLIC_URL),
    VITE_SENTRY_DSN: raw.VITE_SENTRY_DSN,
    VITE_AUTH_NAMESPACE: emptyToUndefined(raw.VITE_AUTH_NAMESPACE),
    VITE_VAPID_PUBLIC_KEY: raw.VITE_VAPID_PUBLIC_KEY,
    VITE_LOCALES: emptyToUndefined(raw.VITE_LOCALES),
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
