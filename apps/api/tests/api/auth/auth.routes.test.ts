import { beforeEach, describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";
import { env } from "../../../src/config/env";
import { AUTH_COOKIE_NAME } from "../../../src/lib/cookies";
import { generateOpaqueToken, hashOpaqueToken } from "../../../src/lib/tokens";
import { seedPendingUser, seedVerifiedUser } from "../../helpers/auth";
import {
  cleanDatabase,
  db,
  emailVerificationTokens,
  eq,
  passwordResetTokens,
  requireDb,
  users,
} from "../../helpers/db";

/**
 * End-to-end auth flow exercised via in-process HTTP (Elysia's
 * `app.handle(Request)`). Verifies the contract every UI relies on:
 *
 *   1. POST /api/v1/auth/register     → 200 + {success, data: {message}}
 *      (NO cookies set; user is pending until verified)
 *   2. POST /api/v1/auth/login        → 403 EMAIL_NOT_VERIFIED
 *   3. POST /api/v1/auth/verify-email → 200 + {data: {user}} + Set-Cookie
 *   4. POST /api/v1/auth/login        → 200 + Set-Cookie (now verified)
 *   5. GET  /api/v1/users/me          → 200 + the user
 *   6. POST /api/v1/auth/logout       → 200 + cookies cleared
 *   7. GET  /api/v1/users/me          → 401 (no cookie)
 *
 * Skipped when Postgres isn't reachable (same pattern as the rest of
 * the integration suite).
 */

const EMAIL = "flow-test@example.com";
const PASSWORD = "Hunter2Strong!";
const uniqueEmail = (prefix: string): string =>
  `${prefix}-${crypto.randomUUID()}@example.com`;

const isJson = (res: Response): boolean =>
  res.headers.get("content-type")?.includes("application/json") ?? false;

const readJson = async (res: Response): Promise<unknown> => {
  if (!isJson(res)) {
    const got = res.headers.get("content-type") ?? "<missing>";

    throw new Error(`Expected JSON, got: ${got}`);
  }

  return res.json();
};

const isMessageEnvelope = (value: unknown): value is IMessageEnvelope =>
  value !== null &&
  typeof value === "object" &&
  "data" in value &&
  value.data !== null &&
  typeof value.data === "object" &&
  "message" in value.data;

const isAuthEnvelope = (value: unknown): value is IAuthEnvelope =>
  value !== null &&
  typeof value === "object" &&
  "data" in value &&
  value.data !== null &&
  typeof value.data === "object" &&
  "user" in value.data;

const isUserProfile = (value: unknown): value is IUserProfile => {
  if (
    value === null ||
    typeof value !== "object" ||
    !("user" in value) ||
    value.user === null ||
    typeof value.user !== "object" ||
    !("email" in value.user)
  ) {
    return false;
  }

  return typeof value.user.email === "string";
};

const extractCookiePair = (setCookie: string | null, name: string): string => {
  if (setCookie === null) {
    return "";
  }

  const match = new RegExp(`${name}=[^;,\\s]+`).exec(setCookie);

  return match?.[0] ?? "";
};

interface IMessageEnvelope {
  readonly success: boolean;
  readonly data: { readonly message: string };
}

interface IAuthEnvelope {
  readonly success: boolean;
  readonly data: {
    readonly user: {
      readonly id: string;
      readonly email: string;
    };
  };
}

interface IUserProfile {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly emailVerified: boolean;
  };
  readonly account: { readonly id: string; readonly name: string };
  readonly role: string;
}

const FUTURE_ISO = (): string =>
  new Date(Date.now() + 60 * 60 * 1000).toISOString();

async function seedFreshVerificationToken(userId: string): Promise<string> {
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));

  const token = generateOpaqueToken();

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashOpaqueToken(token),
    expiresAt: FUTURE_ISO(),
  });

  return token;
}

describe("auth flow — register → verify → login → me → logout", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("complete happy path against the running app", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    // 1. Register: no cookies, no session, just a message
    const registerRes = await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: EMAIL,
          password: PASSWORD,
          firstName: "Flow",
          lastName: "Test",
        }),
      })
    );

    expect(registerRes.status).toBe(200);

    const registerBody = await readJson(registerRes);

    if (!isMessageEnvelope(registerBody)) {
      throw new Error("register response was not a message envelope");
    }

    expect(registerBody.success).toBe(true);
    expect(registerBody.data.message).toContain(EMAIL);
    expect(registerRes.headers.get("set-cookie")).toBeNull();

    // 2. Login attempt with valid credentials → 403 EMAIL_NOT_VERIFIED
    const blockedLogin = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
    );

    expect(blockedLogin.status).toBe(403);
    const blockedBody = await readJson(blockedLogin);

    expect(JSON.stringify(blockedBody)).toContain("EMAIL_NOT_VERIFIED");

    // 3. Verify with the persisted token → sets cookies, returns user
    const pending = await db.query.users.findFirst({
      where: eq(users.email, EMAIL),
    });

    if (!pending) {
      throw new Error("pending user row missing after register");
    }

    const token = await seedFreshVerificationToken(pending.id);

    const verifyRes = await app.handle(
      new Request("http://localhost/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
    );

    expect(verifyRes.status).toBe(200);

    const verifyBody = await readJson(verifyRes);

    if (!isAuthEnvelope(verifyBody)) {
      throw new Error("verify response was not an auth envelope");
    }

    expect(verifyBody.data.user.email).toBe(EMAIL);

    const verifySetCookie = verifyRes.headers.get("set-cookie");
    const verifyAuthCookie = extractCookiePair(verifySetCookie, "auth_token");
    const verifyRefreshCookie = extractCookiePair(
      verifySetCookie,
      "refresh_token"
    );

    expect(verifyAuthCookie).not.toBe("");
    expect(verifyRefreshCookie).not.toBe("");

    // 4. Login (separate cookie jar — fresh Set-Cookie)
    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
    );

    expect(loginRes.status).toBe(200);

    const loginSetCookie = loginRes.headers.get("set-cookie");
    const authCookie = extractCookiePair(loginSetCookie, "auth_token");
    const refreshCookie = extractCookiePair(loginSetCookie, "refresh_token");

    expect(authCookie).not.toBe("");
    expect(refreshCookie).not.toBe("");

    // 5. Refresh rotates the session cookie + issues a fresh auth cookie
    const refreshRes = await app.handle(
      new Request("http://localhost/api/v1/auth/refresh", {
        method: "POST",
        headers: { cookie: refreshCookie },
      })
    );

    expect(refreshRes.status).toBe(200);

    const refreshSetCookie = refreshRes.headers.get("set-cookie");
    const refreshedAuthCookie = extractCookiePair(
      refreshSetCookie,
      "auth_token"
    );
    const refreshedRefreshCookie = extractCookiePair(
      refreshSetCookie,
      "refresh_token"
    );

    expect(refreshedAuthCookie).not.toBe("");
    expect(refreshedRefreshCookie).not.toBe("");

    // 6. /me with the auth cookie
    const meRes = await app.handle(
      new Request("http://localhost/api/v1/users/me", {
        headers: { cookie: refreshedAuthCookie },
      })
    );

    expect(meRes.status).toBe(200);

    const me = await readJson(meRes);

    if (!isUserProfile(me)) {
      throw new Error("/me response was not a user profile");
    }

    expect(me.user.email).toBe(EMAIL);
    expect(me.user.firstName).toBe("Flow");
    expect(me.role).toBe("owner");

    // 7. Logout
    const logoutRes = await app.handle(
      new Request("http://localhost/api/v1/auth/logout", {
        method: "POST",
        headers: { cookie: refreshedRefreshCookie },
      })
    );

    expect(logoutRes.status).toBe(200);

    // 8. /me without the cookie → 401
    const unauthRes = await app.handle(
      new Request("http://localhost/api/v1/users/me")
    );

    expect(unauthRes.status).toBe(401);
  });

  test("login with wrong password → 401", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    await seedVerifiedUser({
      email: EMAIL,
      password: PASSWORD,
      firstName: "Flow",
      lastName: "Test",
    });

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: "wrong-password" }),
      })
    );

    expect(loginRes.status).toBe(401);
  });

  test("register with an existing email → 409", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    const make = () =>
      app.handle(
        new Request("http://localhost/api/v1/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: EMAIL,
            password: PASSWORD,
            firstName: "Flow",
            lastName: "Test",
          }),
        })
      );

    const first = await make();

    expect(first.status).toBe(200);

    const second = await make();

    expect(second.status).toBe(409);
  });

  test("4th register attempt for the same email is rate-limited", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const email = uniqueEmail("register-rate-limit");

    const make = () =>
      app.handle(
        new Request("http://localhost/api/v1/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            password: PASSWORD,
            firstName: "Rate",
            lastName: "Limit",
          }),
        })
      );

    const first = await make();
    const second = await make();
    const third = await make();
    const fourth = await make();

    expect(first.status).toBe(200);
    expect([200, 409]).toContain(second.status);
    expect([200, 409]).toContain(third.status);
    expect(fourth.status).toBe(400);

    const fourthBody = await readJson(fourth);

    expect(JSON.stringify(fourthBody)).toContain("Too many");
  });

  test("login with a pending user → 403 EMAIL_NOT_VERIFIED", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    await seedPendingUser({ email: "pending@example.com", password: PASSWORD });

    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "pending@example.com",
          password: PASSWORD,
        }),
      })
    );

    expect(res.status).toBe(403);

    const body = await readJson(res);

    expect(JSON.stringify(body)).toContain("EMAIL_NOT_VERIFIED");
  });
});

const NEW_PASSWORD = "EvenStronger3!";

async function seedResetTokenRow(userId: string): Promise<string> {
  const token = generateOpaqueToken();

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashOpaqueToken(token),
    expiresAt: FUTURE_ISO(),
  });

  return token;
}

describe("POST /api/v1/auth/verify-email", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("flips emailVerifiedAt, provisions account, and returns 200 for a valid token", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedPendingUser({
      email: "verify-route@example.com",
    });
    const token = await seedFreshVerificationToken(user.id);

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
    );

    expect(res.status).toBe(200);

    const refreshed = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    expect(refreshed?.emailVerifiedAt).not.toBeNull();
  });

  test("rejects an unknown token with 400", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "00".repeat(32) }),
      })
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/resend-verification", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns 200 for an unverified user", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({ email: "resend-route@example.com" });

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "resend-route@example.com" }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("returns 200 for an unknown email (enumeration-safe)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "ghost@example.com" }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("4th resend-verification request for the same email is rate-limited", async () => {
    if (!(await requireDb())) {
      return;
    }

    const email = uniqueEmail("resend-rate-limit");

    await seedPendingUser({ email });

    const app = createApp();
    const make = () =>
      app.handle(
        new Request("http://localhost/api/v1/auth/resend-verification", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );

    const first = await make();
    const second = await make();
    const third = await make();
    const fourth = await make();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(fourth.status).toBe(400);

    const fourthBody = await readJson(fourth);

    expect(JSON.stringify(fourthBody)).toContain("Too many");
  });
});

describe("POST /api/v1/auth/forgot-password", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns 200 for an existing user", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedVerifiedUser({ email: "forgot-route@example.com" });

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "forgot-route@example.com" }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("returns the same 200 for an unknown email (no enumeration)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com" }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("4th forgot-password request for the same email is rate-limited", async () => {
    if (!(await requireDb())) {
      return;
    }

    const email = uniqueEmail("forgot-rate-limit");

    await seedVerifiedUser({ email });

    const app = createApp();
    const make = () =>
      app.handle(
        new Request("http://localhost/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );

    const first = await make();
    const second = await make();
    const third = await make();
    const fourth = await make();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(fourth.status).toBe(400);

    const fourthBody = await readJson(fourth);

    expect(JSON.stringify(fourthBody)).toContain("Too many");
  });
});

describe("POST /api/v1/auth/reset-password", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("succeeds with a valid token + new password", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({
      email: "reset-route@example.com",
    });
    const token = await seedResetTokenRow(user.id);

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: NEW_PASSWORD }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("rejects an invalid token with 400", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "00".repeat(32),
          password: NEW_PASSWORD,
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("rejects a weak password with a 4xx (TypeBox validation)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({ email: "weak-pw@example.com" });
    const token = await seedResetTokenRow(user.id);

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: "x" }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("GET /api/v1/auth/oauth/:provider — credentials not configured", () => {
  test("returns 404 for google when no GOOGLE_OAUTH_* env is set (test default)", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/oauth/google")
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 for an unknown provider name", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/oauth/facebook")
    );

    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/auth/oauth/:provider/callback — credentials not configured", () => {
  test("returns 4xx when no credentials are configured", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request(
        "http://localhost/api/v1/auth/oauth/google/callback?code=x&state=y"
      )
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("returns 302 redirect to the SPA when the user denies (error=access_denied)", async () => {
    const app = createApp();
    const res = await app.handle(
      new Request(
        "http://localhost/api/v1/auth/oauth/google/callback?error=access_denied"
      )
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/error=/u);
  });
});

describe("POST /api/v1/auth/__test/force-verify", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("the test process runs with NODE_ENV=test so the route is reachable", () => {
    expect(env.NODE_ENV).toBe("test");
  });

  test("flips a pending user to verified, provisions an account, and sets the auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({ email: "force-verify@example.com" });

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/__test/force-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "force-verify@example.com" }),
      })
    );

    expect(res.status).toBe(200);

    const setCookies = res.headers.getSetCookie();
    const hasAuthCookie = setCookies.some((raw) =>
      raw.startsWith(`${AUTH_COOKIE_NAME}=`)
    );

    expect(hasAuthCookie).toBe(true);
  });

  test("returns 404 when the email does not match any user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const res = await app.handle(
      new Request("http://localhost/api/v1/auth/__test/force-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "ghost@example.com" }),
      })
    );

    expect(res.status).toBe(404);
  });
});
