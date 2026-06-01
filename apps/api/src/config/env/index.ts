import type { Env } from "./schema";
import { validateEnv } from "./validate";

const validated = validateEnv();

/**
 * Frozen runtime configuration. Read-only — anything that needs to mutate
 * at runtime belongs in a service, not env.
 */
export const env: Env & {
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly isTest: boolean;
} = Object.freeze({
  ...validated,
  isDevelopment: validated.NODE_ENV === "development",
  isProduction: validated.NODE_ENV === "production",
  isTest: validated.NODE_ENV === "test",
});

export type { Env } from "./schema";
