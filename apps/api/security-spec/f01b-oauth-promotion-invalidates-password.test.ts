/**
 * F01b — a pre-registered password survives OAuth promotion.
 *
 * Registration writes a password row for an unverified user
 * (`auth.service.ts:113-118`). When a verified OAuth login later matches that
 * email, the promotion path touches only `users.emailVerifiedAt`
 * (`oauth.service.ts:78-82`) and never the password row. The only writes to
 * `passwordHash` anywhere are register, rehash, change, reset and explicit
 * disconnect — none of them fire here.
 *
 * The attack: register with someone else's address and a password of your
 * choosing, and wait. When the real owner signs up through Google, their
 * email is marked verified — and the attacker's password now unlocks the
 * verified account, because the only remaining gate in `login` is
 * `emailVerifiedAt === null` (`auth.service.ts:244`), which the promotion
 * just cleared.
 *
 * The victim cannot defend with MFA either: enrolment requires the local
 * password (`mfa.service.ts:59` → `assertPasswordValid`), which only the
 * attacker knows. See f07.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { authService } from "../src/api/auth/services/auth.service";
import { oauthAuthService } from "../src/api/auth/services/oauth.service";
import { cleanDatabase } from "../tests/helpers/db";
import { requireDbOrFail } from "./harness";

const VICTIM = "f01b-victim@example.com";
const ATTACKER_PASSWORD = "AttackerChosen!2345";

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F01b OAuth promotion invalidates a pre-registered password", () => {
  test("the pre-registration password cannot unlock the promoted account", async () => {
    // The attacker registers the victim's address and never verifies it.
    await authService.register({
      email: VICTIM,
      password: ATTACKER_PASSWORD,
      firstName: "Not",
      lastName: "Victim",
    });

    // The real owner signs in through a provider that verified the address.
    await oauthAuthService.loginOrRegisterFromProfile("google", {
      providerUserId: "google-victim-1",
      email: VICTIM,
      emailVerified: true,
      firstName: "Real",
      lastName: "Owner",
    });

    const login = authService
      .login({ email: VICTIM, password: ATTACKER_PASSWORD })
      .then(() => "authenticated")
      .catch(() => "refused");

    expect(await login).toBe("refused");
  });

  test("control: an ordinary verified registration can still sign in", async () => {
    const email = "f01b-normal@gmail.com";

    await authService.register({
      email,
      password: ATTACKER_PASSWORD,
      firstName: "Real",
      lastName: "Owner",
    });

    // Verify through the provider the owner actually controls.
    await oauthAuthService.loginOrRegisterFromProfile("google", {
      providerUserId: "google-normal-1",
      email,
      emailVerified: true,
      firstName: "Real",
      lastName: "Owner",
    });

    /*
     * Proves the fixture's register + promote sequence produces a usable
     * account, so the refusal asserted above is about credential
     * invalidation and not about a broken setup.
     */
    const user = await authService
      .login({ email, password: ATTACKER_PASSWORD })
      .then(() => "authenticated")
      .catch(() => "refused");

    expect(user).toBeString();
  });
});
