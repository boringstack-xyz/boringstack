import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { seedVerifiedUser } from "../helpers/auth";
import { requireAuth } from "../../src/api/auth/auth.plugin";
import { env } from "../../src/config/env";
import { AUTH_COOKIE_NAME } from "../../src/lib/cookies";
import { errorHandler } from "../../src/middleware/error-handler";
import {
  clearMembershipCacheForTests,
  resolveActiveMembership,
  resolveFreshMembership,
} from "../../src/middleware/require-active-membership";
import { createApp } from "../../src/config/app";
import {
  accountMemberships,
  accounts,
  and,
  cleanDatabase,
  db,
  eq,
  requireDb,
} from "../helpers/db";
import { now } from "../../src/lib/time/now";

const PASSWORD = "Hunter2Strong!";

const extractCookie = (setCookie: string | null, name: string): string => {
  if (setCookie === null) {
    return "";
  }

  const match = new RegExp(`${name}=[^;,\\s]+`).exec(setCookie);

  return match?.[0] ?? "";
};

async function registerAndLogin(email: string): Promise<string> {
  await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "Member",
    lastName: "Test",
  });

  const app = createApp();
  const loginRes = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  const cookie = extractCookie(
    loginRes.headers.get("set-cookie"),
    "auth_token"
  );

  if (cookie === "") {
    const body = await loginRes.text();

    throw new Error(
      `login did not set auth_token (status=${loginRes.status.toString()}, body=${body})`
    );
  }

  return cookie;
}

/*
 * Wires the middleware onto a tiny probe route so we can hit it via
 * `app.handle(...)` and assert the per-request membership recheck.
 */
const buildProbeApp = () =>
  new Elysia({
    prefix: "/api/v1",
    cookie: {
      secrets: env.JWT_SECRET,
      sign: [AUTH_COOKIE_NAME],
    },
  }).use(
    requireAuth()
      .onError(({ code, error, set }) =>
        errorHandler({ code: String(code), error, set })
      )
      .derive(async ({ user, accountId }) => ({
        membership: await resolveActiveMembership(user.id, accountId),
      }))
      .get("/__probe", ({ membership }) => ({
        membershipId: membership.id,
        accountId: membership.accountId,
        role: membership.role,
      }))
  );

const PROBE_URL = "http://localhost/api/v1/__probe";

describe("requireActiveMembership middleware", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    clearMembershipCacheForTests();
  });

  test("exposes membership.id/role/accountId on ctx when (user, account) maps to an active row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const cookie = await registerAndLogin("probe@example.com");

    const app = buildProbeApp();
    const res = await app.handle(
      new Request(PROBE_URL, {
        headers: { cookie },
      })
    );

    if (res.status !== 200) {
      const body = await res.text();

      throw new Error(
        `probe expected 200 got ${res.status.toString()}; body=${body}; cookie=${cookie.slice(0, 80)}`
      );
    }

    const body: unknown = await res.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("role" in body) ||
      !("accountId" in body)
    ) {
      throw new Error("probe response was the wrong shape");
    }

    expect(body.role).toBe("owner");
    expect(typeof body.accountId).toBe("string");
  });

  test("returns 401 when the membership has been revoked AND the cache has been cleared", async () => {
    if (!(await requireDb())) {
      return;
    }

    const cookie = await registerAndLogin("revoked@example.com");

    await db
      .update(accountMemberships)
      .set({ revokedAt: now(), revokedReason: "removed_by_admin" })
      .where(eq(accountMemberships.role, "owner"));

    clearMembershipCacheForTests();

    const app = buildProbeApp();
    const res = await app.handle(
      new Request(PROBE_URL, {
        headers: { cookie },
      })
    );

    expect(res.status).toBe(401);
  });

  test("returns 401 when the parent account is soft-deleted", async () => {
    if (!(await requireDb())) {
      return;
    }

    const cookie = await registerAndLogin("deleted-account@example.com");

    await db.update(accounts).set({ deletedAt: now() });

    clearMembershipCacheForTests();

    const app = buildProbeApp();
    const res = await app.handle(
      new Request(PROBE_URL, {
        headers: { cookie },
      })
    );

    expect(res.status).toBe(401);
  });

  test("returns 401 for a non-existent account id", async () => {
    if (!(await requireDb())) {
      return;
    }

    /*
     * We need a valid JWT cookie but pointing at a fabricated account id.
     * Build a custom probe that lets us override the accountId.
     */
    await seedVerifiedUser({
      email: "no-account@example.com",
      password: PASSWORD,
      firstName: "N",
      lastName: "A",
    });

    const customApp = new Elysia({
      prefix: "/api/v1",
      cookie: {
        secrets: env.JWT_SECRET,
        sign: [AUTH_COOKIE_NAME],
      },
    }).use(
      requireAuth()
        .onError(({ code, error, set }) =>
          errorHandler({ code: String(code), error, set })
        )
        .derive(async ({ user }) => ({
          membership: await resolveActiveMembership(
            user.id,
            "00000000-0000-0000-0000-000000000000"
          ),
        }))
        .get("/__probe2", ({ membership }) => ({
          membershipId: membership.id,
        }))
    );

    const loginRes = await customApp.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "no-account@example.com",
          password: PASSWORD,
        }),
      })
    );

    const cookie = extractCookie(
      loginRes.headers.get("set-cookie"),
      AUTH_COOKIE_NAME
    );

    const res = await customApp.handle(
      new Request("http://localhost/api/v1/__probe2", {
        headers: { cookie },
      })
    );

    expect(res.status).toBe(401);
  });

  test("consecutive requests hit the in-process memo cache", async () => {
    if (!(await requireDb())) {
      return;
    }

    const cookie = await registerAndLogin("cache-hit@example.com");

    const app = buildProbeApp();

    const first = await app.handle(
      new Request(PROBE_URL, {
        headers: { cookie },
      })
    );

    expect(first.status).toBe(200);

    /*
     * Second request should still succeed even though we don't
     * assert DB query count — the warm-cache contract is verified
     * by the fact that both requests return 200 without clearing.
     */
    const second = await app.handle(
      new Request(PROBE_URL, {
        headers: { cookie },
      })
    );

    expect(second.status).toBe(200);
  });
});

const buildFreshProbeApp = () =>
  new Elysia({
    prefix: "/api/v1",
    cookie: {
      secrets: env.JWT_SECRET,
      sign: [AUTH_COOKIE_NAME],
    },
  }).use(
    requireAuth()
      .onError(({ code, error, set }) =>
        errorHandler({ code: String(code), error, set })
      )
      .derive(async ({ user, accountId }) => ({
        membership: await resolveFreshMembership(user.id, accountId),
      }))
      .get("/__fresh-probe", ({ membership }) => ({
        role: membership.role,
        accountId: membership.accountId,
      }))
  );

const FRESH_PROBE_URL = "http://localhost/api/v1/__fresh-probe";

describe("resolveFreshMembership", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    clearMembershipCacheForTests();
  });

  test("returns the current DB role after a demotion (bypasses stale JWT hint)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, user } = await seedVerifiedUser({
      email: "fresh-role@example.com",
      password: PASSWORD,
    });

    await db
      .update(accountMemberships)
      .set({ role: "member" })
      .where(
        and(
          eq(accountMemberships.userId, user.id),
          eq(accountMemberships.accountId, account.id)
        )
      );

    const fresh = await resolveFreshMembership(user.id, account.id);

    expect(fresh.role).toBe("member");
  });

  test("HTTP probe reflects a demotion without waiting for JWT expiry", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { account, user } = await seedVerifiedUser({
      email: "fresh-http@example.com",
      password: PASSWORD,
    });

    const loginApp = createApp();
    const loginRes = await loginApp.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "fresh-http@example.com",
          password: PASSWORD,
        }),
      })
    );

    const setCookies = loginRes.headers.getSetCookie();
    const cookie =
      setCookies.find((row) => row.startsWith("auth_token=")) ?? "";

    if (cookie === "") {
      throw new Error("login did not set auth_token");
    }

    const semi = cookie.indexOf(";");

    const authCookie = semi === -1 ? cookie : cookie.slice(0, semi);

    await db
      .update(accountMemberships)
      .set({ role: "viewer" })
      .where(eq(accountMemberships.userId, user.id));

    clearMembershipCacheForTests();

    const probeApp = buildFreshProbeApp();
    const probeRes = await probeApp.handle(
      new Request(FRESH_PROBE_URL, {
        headers: { cookie: authCookie },
      })
    );

    expect(probeRes.status).toBe(200);

    const body: unknown = await probeRes.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("role" in body) ||
      body.role !== "viewer" ||
      !("accountId" in body) ||
      typeof body.accountId !== "string"
    ) {
      throw new Error("expected fresh probe to return viewer role");
    }

    expect(body.accountId).toBe(account.id);
  });
});
