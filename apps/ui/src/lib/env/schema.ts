import { z } from "zod";

const localesSchema = z
  .string()
  .min(1)
  .default("en")
  .transform((s) =>
    s
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );

export const envSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default("BoringStack"),
  /*
   * Empty string = "use same-origin relative paths"; the dev server proxies
   * /api to VITE_API_PROXY_TARGET, and same-domain reverse proxies do the
   * same in prod. Any non-empty value must be a full URL (cross-origin API).
   */
  VITE_API_URL: z.union([z.literal(""), z.url()]).default(""),
  VITE_PUBLIC_URL: z.url().default("http://localhost:7331"),
  VITE_SENTRY_DSN: z.string().optional().default(""),
  VITE_AUTH_NAMESPACE: z.string().min(1).default("apps/ui"),
  /*
   * VAPID public key for Web Push. Generate the matching set on the API
   * side via `bun run vapid:generate` and paste the PUBLIC half here.
   * The subscribe UI also requires `capabilities.features.notifications.webPush`.
   * Empty disables the in-browser subscribe flow.
   */
  VITE_VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VITE_LOCALES: localesSchema,
  MODE: z.enum(["development", "production", "test"]).default("development"),
  DEV: z.boolean().default(true),
  PROD: z.boolean().default(false)
});
