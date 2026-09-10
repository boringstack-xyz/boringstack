/**
 * F01a: automatic OAuth linking does not check who proved the email.
 *
 * `src/api/auth/services/oauth.service.ts:67-87` inserts a new
 * `user_auth_providers` row whenever the incoming profile's email matches an
 * existing user. Nothing consults `profile.emailVerified` on that path. The
 * guard that follows reads the STORED user:
 *
 *   oauth.service.ts:124
 *     if (userRow.emailVerifiedAt === null) throw ApiErrors.emailNotVerified();
 *
 * So when the local account is already verified, an unverified provider
 * identity carrying the same address is linked and authenticated. Explicit
 * linking gets this right (`oauth.service.ts:188-193` checks
 * `profile.emailVerified`); only the automatic path does not.
 *
 * Provider choice matters. GitHub cannot currently reach this because F01c
 * makes it fail closed. Google and LinkedIn read genuine OIDC
 * `email_verified`, so they are the live exposure, hence "google" here.
 *
 * This behaviour is currently PINNED by
 * `tests/api/auth/services/oauth.service.test.ts:154`, "re-links + provisions
 * for an existing verified password user", which passes `emailVerified: false`
 * and asserts success. That test encodes the vulnerability as intent and must
 * be retired as part of the fix. It also opens with the silent-bail pattern,
 * so it passes vacuously with no database.
 *
 * POLICY (ROADMAP decision 1): this encodes "reject the auto-link". If the
 * project instead keeps verified-email auto-linking, the assertion becomes
 * "accepted only when profile.emailVerified is true", which the second test
 * already covers.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { oauthAuthService } from "../src/api/auth/services/oauth.service";
import type { IOAuthProfile } from "../src/lib/oauth/oauth.types";
import { cleanDatabase, db, eq, userAuthProviders } from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail } from "./harness";

const VICTIM = "victim-f01a@example.com";

const profile = (overrides: Partial<IOAuthProfile> = {}): IOAuthProfile => ({
  providerUserId: "google-attacker-1",
  email: VICTIM,
  emailVerified: false,
  firstName: "",
  lastName: "",
  ...overrides,
});

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F01a OAuth auto-link requires proof of the email", () => {
  test("an unverified provider identity cannot attach to a verified user", async () => {
    const { user } = await seedVerifiedUser({ email: VICTIM });

    const outcome = await oauthAuthService
      .loginOrRegisterFromProfile("google", profile())
      .then(() => "accepted" as const)
      .catch(() => "rejected" as const);

    expect(outcome).toBe("rejected");

    /*
     * Rejecting is not enough on its own: the link must not survive. The
     * insert happens before the guard, so this asserts the rollback as well
     * as the refusal.
     */
    const linked = await db
      .select()
      .from(userAuthProviders)
      .where(eq(userAuthProviders.userId, user.id));

    expect(linked.filter((row) => row.provider === "google")).toBeEmpty();
  });

  test("control: a verified provider identity is accepted", async () => {
    await seedVerifiedUser({ email: VICTIM });

    const result = await oauthAuthService.loginOrRegisterFromProfile(
      "google",
      profile({ emailVerified: true })
    );

    expect(result.user.email).toBe(VICTIM);
  });
});
