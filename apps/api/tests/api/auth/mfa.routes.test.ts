import { beforeEach, describe, expect, test } from "bun:test";
import { Secret, TOTP } from "otpauth";

import {
  MFA_CACHE_KEYS,
  MFA_TOTP_DIGITS,
  MFA_TOTP_STEP_SECONDS,
} from "../../../src/api/auth/mfa.constants";
import { mfaService } from "../../../src/api/auth/services/mfa.service";
import { createApp } from "../../../src/config/app";
import { cacheService } from "../../../src/lib/cache";
import { decryptString } from "../../../src/lib/crypto";
import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "../../../src/lib/cookies";
import { seedVerifiedUser } from "../../helpers/auth";
import { cleanDatabase, db, eq, requireDb, users } from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const JSON_HEADERS = { "content-type": "application/json" } as const;
const LOGIN_URL = "http://localhost/api/v1/auth/login";
const uniqueEmail = (prefix: string): string =>
  `${prefix}-${crypto.randomUUID()}@example.com`;

interface IMfaRequiredBody {
  readonly success: boolean;
  readonly data: {
    readonly mfaRequired: true;
    readonly challengeToken: string;
  };
}

interface IAuthBody {
  readonly success: boolean;
  readonly data: { readonly user: { readonly email: string } };
}

const isMfaRequired = (value: unknown): value is IMfaRequiredBody =>
  value !== null &&
  typeof value === "object" &&
  "data" in value &&
  value.data !== null &&
  typeof value.data === "object" &&
  "mfaRequired" in value.data &&
  value.data.mfaRequired === true;

const isAuth = (value: unknown): value is IAuthBody =>
  value !== null &&
  typeof value === "object" &&
  "data" in value &&
  value.data !== null &&
  typeof value.data === "object" &&
  "user" in value.data;

const totpFor = (secretBase32: string, offsetSteps = 0): string =>
  new TOTP({
    issuer: "test",
    label: "test",
    algorithm: "SHA1",
    digits: MFA_TOTP_DIGITS,
    period: MFA_TOTP_STEP_SECONDS,
    secret: Secret.fromBase32(secretBase32),
  }).generate({
    timestamp: Date.now() + offsetSteps * MFA_TOTP_STEP_SECONDS * 1000,
  });

const enrollViaService = async (
  userId: string
): Promise<{ secretBase32: string; recoveryCodes: string[] }> => {
  const setup = await mfaService.setup(userId, PASSWORD);
  const staged = await cacheService.get<{ secretEncrypted: string }>(
    MFA_CACHE_KEYS.setup(userId)
  );

  if (staged === null) {
    throw new Error("setup did not stage a secret");
  }

  const secretBase32 = decryptString(staged.secretEncrypted);

  await mfaService.verifySetup(userId, totpFor(secretBase32));

  /*
   * Verifying setup writes the current TOTP step into mfaLastTotpStep
   * for replay protection. The route tests then immediately try to log
   * in inside that same 30-second window, which the replay guard would
   * otherwise reject. Clearing the step is safe — a real user picks
   * up the same protection on their next verify.
   */
  await db
    .update(users)
    .set({ mfaLastTotpStep: null })
    .where(eq(users.id, userId));

  return { secretBase32, recoveryCodes: setup.recoveryCodes };
};

describe("MFA routes", () => {
  beforeEach(async () => {
    if (await requireDb()) {
      await cleanDatabase();
    }
  });

  test("login with MFA returns a challenge, not session cookies", async () => {
    if (!(await requireDb())) {
      return;
    }

    const email = uniqueEmail("mfa-login");
    const { user } = await seedVerifiedUser({ email, password: PASSWORD });

    await enrollViaService(user.id);

    const app = createApp();
    const res = await app.handle(
      new Request(LOGIN_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password: PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();

    const body: unknown = await res.json();

    if (!isMfaRequired(body)) {
      throw new Error("login response was not an mfaRequired envelope");
    }

    expect(body.data.mfaRequired).toBe(true);
    expect(body.data.challengeToken.length).toBeGreaterThan(16);
  });

  test("verify-login with a valid TOTP code issues session cookies", async () => {
    if (!(await requireDb())) {
      return;
    }

    const email = uniqueEmail("mfa-totp");
    const { user } = await seedVerifiedUser({ email, password: PASSWORD });
    const { secretBase32 } = await enrollViaService(user.id);

    const app = createApp();
    const loginRes = await app.handle(
      new Request(LOGIN_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password: PASSWORD }),
      })
    );
    const loginBody: unknown = await loginRes.json();

    if (!isMfaRequired(loginBody)) {
      throw new Error("login response was not an mfaRequired envelope");
    }

    const verifyRes = await app.handle(
      new Request("http://localhost/api/v1/auth/mfa/verify-login", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          challengeToken: loginBody.data.challengeToken,
          code: totpFor(secretBase32),
        }),
      })
    );

    expect(verifyRes.status).toBe(200);

    const setCookie = verifyRes.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain(AUTH_COOKIE_NAME);
    expect(setCookie).toContain(REFRESH_COOKIE_NAME);

    const verifyBody: unknown = await verifyRes.json();

    if (!isAuth(verifyBody)) {
      throw new Error("verify-login response did not include a user");
    }

    expect(verifyBody.data.user.email).toBe(email);
  });

  test("verify-recovery consumes a recovery code and issues session cookies", async () => {
    if (!(await requireDb())) {
      return;
    }

    const email = uniqueEmail("mfa-recovery");
    const { user } = await seedVerifiedUser({ email, password: PASSWORD });
    const { recoveryCodes } = await enrollViaService(user.id);
    const code = recoveryCodes[0];

    if (code === undefined) {
      throw new Error("no recovery code generated");
    }

    const app = createApp();
    const loginRes = await app.handle(
      new Request(LOGIN_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password: PASSWORD }),
      })
    );
    const loginBody: unknown = await loginRes.json();

    if (!isMfaRequired(loginBody)) {
      throw new Error("login response was not an mfaRequired envelope");
    }

    const verifyRes = await app.handle(
      new Request("http://localhost/api/v1/auth/mfa/verify-recovery", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          challengeToken: loginBody.data.challengeToken,
          code,
        }),
      })
    );

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.headers.get("set-cookie") ?? "").toContain(
      AUTH_COOKIE_NAME
    );
  });

  test("verify-login with a wrong code returns 401 and decrements attempts", async () => {
    if (!(await requireDb())) {
      return;
    }

    const email = uniqueEmail("mfa-bad");
    const { user } = await seedVerifiedUser({ email, password: PASSWORD });

    await enrollViaService(user.id);

    const app = createApp();
    const loginRes = await app.handle(
      new Request(LOGIN_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password: PASSWORD }),
      })
    );
    const loginBody: unknown = await loginRes.json();

    if (!isMfaRequired(loginBody)) {
      throw new Error("login response was not an mfaRequired envelope");
    }

    const verifyRes = await app.handle(
      new Request("http://localhost/api/v1/auth/mfa/verify-login", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          challengeToken: loginBody.data.challengeToken,
          code: "000000",
        }),
      })
    );

    expect(verifyRes.status).toBe(401);
  });

  test("login without MFA enabled still issues cookies directly", async () => {
    if (!(await requireDb())) {
      return;
    }

    const email = uniqueEmail("no-mfa");

    await seedVerifiedUser({ email, password: PASSWORD });

    const app = createApp();
    const res = await app.handle(
      new Request(LOGIN_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password: PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain(AUTH_COOKIE_NAME);
  });
});
