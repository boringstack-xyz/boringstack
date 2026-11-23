import { z } from "zod";

/** An unset or empty variable reads as "not given". */
const given = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

/**
 * Where the verification robot runs and what it may expect there. With no
 * variables set it walks the local dev stack. In CI, production-verification.yml
 * points it at production through ROBOT_APP_URL and ROBOT_SITE_URL. See
 * docs/operations/production-verification.md.
 */
export const robotConfig = z
  .object({
    /** The app the robot signs up in and uses. */
    appURL: z.url(),
    /** The public site. Unset leaves the site checks out (a local stack may have none). */
    siteURL: z.url().optional(),
    /** Fewer sitemap pages than this means the sitemap itself is broken. */
    siteMinPages: z.coerce.number().int().positive(),
    /** SYNTHETIC_CHECK_SECRET: lets the robot verify, upgrade and remove its own account. */
    secret: z.string().min(32).optional(),
    /** True where Stripe is the real service (production): checkout must open. */
    liveServices: z.boolean(),
    /**
     * Requests a minute the robot allows itself: to the API, and to its
     * sign-in routes. The defaults sit under production's limits (100 at the
     * edge and AUTH_RATE_LIMIT_MAX=10); a stack with other limits sets its own.
     */
    apiPerMinute: z.coerce.number().int().positive(),
    signInPerMinute: z.coerce.number().int().positive()
  })
  .parse({
    appURL:
      given(process.env.ROBOT_APP_URL) ??
      `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "7331"}`,
    siteURL: given(process.env.ROBOT_SITE_URL),
    siteMinPages: given(process.env.ROBOT_SITE_MIN_PAGES) ?? 1,
    secret: given(process.env.SYNTHETIC_CHECK_SECRET),
    liveServices: process.env.ROBOT_LIVE_SERVICES === "true",
    apiPerMinute: given(process.env.ROBOT_API_PER_MINUTE) ?? 85,
    signInPerMinute: given(process.env.ROBOT_SIGN_IN_PER_MINUTE) ?? 7
  });
