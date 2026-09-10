/**
 * F07 — MFA does not cover the OAuth login path.
 *
 * `mfaEnabledAt` is consulted on the password path only
 * (`auth.service.ts:258`). A repo-wide search finds it in the schema, the
 * status probe (`mfa.routes.ts:145`), the setup/verify/disable guards, and
 * that one line. `oauth.service.ts` never reads it, and the callback goes
 * straight to `sessionService.create` (`auth.routes.ts:514-528`).
 *
 * So a user who has enabled MFA is protected when signing in with a password
 * and unprotected when signing in with Google.
 *
 * Asserted at the HTTP callback, on whether a session cookie is issued. An
 * earlier version checked a property of the service's return value, which
 * constrains the shape of the fix rather than the security contract: a design
 * that returns something different but correctly withholds the session should
 * pass.
 *
 * POLICY (ROADMAP decision: MFA assurance): this encodes account-wide MFA. If the project instead
 * treats a trusted IdP as sufficient assurance, this becomes
 * provider-conditional.
 *
 * Not asserted here: that an OAuth-only user can enrol a factor at all.
 * `assertPasswordValid` (`mfa.service.ts:475-508`) fails closed for
 * password-less accounts, so today they cannot — which is what makes the F01b
 * attack undefendable. But a safe fix may legitimately require a provider
 * step-up flow that does not exist yet, and any assertion written now would
 * be dictating that design. It is recorded in the README's uncovered list.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { authService } from "../src/api/auth/services/auth.service";
import { createApp } from "../src/config/app/app";
import { now } from "../src/lib/time/now";
import { cleanDatabase, db, eq, users } from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import {
  callback,
  issuesSession,
  restoreFetch,
  startFlow,
  stubGoogle,
} from "./fixtures/oauth-flow";
import {
  requireDbOrFail,
  requireValkeyOrFail,
  specPrecondition,
} from "./harness";

const MFA_USER = "f07-mfa@gmail.com";
const PLAIN_USER = "f07-plain@gmail.com";
const PASSWORD = "Hunter2Strong!";

/** A TOTP secret the test can generate valid codes against. */
const MFA_SECRET = "JBSWY3DPEHPK3PXP";

const enableMfa = async (userId: string): Promise<void> => {
  const { encryptString } = await import("../src/lib/crypto/aes-gcm.utils");

  await db
    .update(users)
    .set({ mfaEnabledAt: now(), mfaSecretEncrypted: encryptString(MFA_SECRET) })
    .where(eq(users.id, userId));
};

const signInWithGoogle = async (
  email: string,
  existingApp?: ReturnType<typeof createApp>
): Promise<Response> => {
  stubGoogle({ sub: `google-${email}`, email });

  const app = existingApp ?? createApp();
  const { state, cookies } = await startFlow(app);

  return callback(app, state, cookies);
};

beforeEach(async () => {
  await requireDbOrFail();
  await requireValkeyOrFail();
  await cleanDatabase();
});

afterEach(() => {
  restoreFetch();
});

describe("F07 MFA covers every login path", () => {
  test("an OAuth login for an MFA-enabled user issues no session", async () => {
    const { user } = await seedVerifiedUser({ email: MFA_USER });

    await enableMfa(user.id);

    const res = await signInWithGoogle(MFA_USER);

    /*
     * The password path stops here and returns a challenge. The OAuth path
     * hands over cookies, so enabling MFA protects one door and not the
     * other.
     */
    expect(issuesSession(res)).toBe(false);
  });

  test("control: the OAuth challenge can be completed with a valid factor", async () => {
    const { user } = await seedVerifiedUser({ email: MFA_USER });

    await enableMfa(user.id);

    const app = createApp();
    const res = await signInWithGoogle(MFA_USER, app);

    /*
     * Refusing the session is only half a fix. The challenge has to be
     * completable, or MFA-enabled users are simply locked out of OAuth
     * sign-in — the callback is a redirect, so the challenge travels in an
     * httpOnly cookie and the verify route reads it from there.
     */
    const handoff = res.headers
      .getAll("set-cookie")
      .map((chunk) => chunk.split(";")[0] ?? "")
      .filter((chunk) => chunk.startsWith("mfa_challenge="))
      .join("; ");

    specPrecondition(
      handoff !== "",
      "the callback issued no MFA challenge cookie"
    );

    const { buildTotp } = await import("../src/api/auth/services/mfa.utils");
    const code = buildTotp(MFA_SECRET, MFA_USER).generate();

    const verified = await app.handle(
      new Request("http://localhost/api/v1/auth/mfa/verify-login", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: handoff },
        body: JSON.stringify({ code }),
      })
    );

    expect(issuesSession(verified)).toBe(true);
  });

  test("control: OAuth login without MFA does issue a session", async () => {
    await seedVerifiedUser({ email: PLAIN_USER });

    const res = await signInWithGoogle(PLAIN_USER);

    /*
     * Load-bearing. Without it, the assertion above could pass simply
     * because the stubbed flow never completes, and "no session issued"
     * would mean nothing.
     */
    expect(issuesSession(res)).toBe(true);
  });

  test("control: password login for an MFA-enabled user requires the factor", async () => {
    const { user } = await seedVerifiedUser({ email: MFA_USER });

    await enableMfa(user.id);

    const outcome = await authService.login({
      email: MFA_USER,
      password: PASSWORD,
    });

    /*
     * Proves the fixture really enables MFA, so the OAuth assertion is about
     * coverage rather than about a user whose factor was never switched on.
     */
    expect(outcome).toHaveProperty("mfaRequired", true);
  });
});
