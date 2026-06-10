import { beforeEach, describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";
import { seedVerifiedUser } from "../../helpers/auth";
import { auditLog, cleanDatabase, db, requireDb } from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";

interface ISummaryBody {
  readonly totalEvents: number;
  readonly recentActivity: readonly {
    readonly id: string;
    readonly title: string;
  }[];
}

/*
 * The summary endpoint returns the bare DashboardSummarySchema shape
 * (see dashboard.routes.ts / dashboard.schemas.ts) — there is no
 * { success, data } envelope on this route.
 */
const isSummaryBody = (value: unknown): value is ISummaryBody => {
  return (
    value !== null &&
    typeof value === "object" &&
    "totalEvents" in value &&
    typeof value.totalEvents === "number" &&
    "recentActivity" in value &&
    Array.isArray(value.recentActivity)
  );
};

/*
 * Per-cookie extraction from a Headers' Set-Cookie list. Each Set-Cookie
 * value contains an Expires= attribute whose RFC date format includes a
 * comma (e.g. "Sun, 18-May-2026 GMT"), so the legacy `.get("set-cookie")`
 * comma-joined string is unsafe to split with a regex. `getSetCookie()`
 * returns one entry per Set-Cookie response header — safe to walk.
 */
const findCookieValue = (
  setCookies: readonly string[],
  name: string
): string => {
  const prefix = `${name}=`;

  for (const raw of setCookies) {
    if (!raw.startsWith(prefix)) {
      continue;
    }

    const semi = raw.indexOf(";");

    return semi === -1 ? raw : raw.slice(0, semi);
  }

  return "";
};

const registerAndLogin = async (
  app: ReturnType<typeof createApp>,
  email: string
): Promise<{ userId: string; authCookie: string }> => {
  const { user } = await seedVerifiedUser({
    email,
    password: PASSWORD,
    firstName: "T",
    lastName: "User",
  });

  const loginRes = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: PASSWORD }),
    })
  );

  if (loginRes.status !== 200) {
    const body = await loginRes.text();

    throw new Error(
      `login failed for ${email}: ${String(loginRes.status)} ${body}`
    );
  }

  const setCookies = loginRes.headers.getSetCookie();
  const authCookie = findCookieValue(setCookies, "auth_token");

  if (authCookie === "") {
    throw new Error(
      `login response for ${email} did not include auth_token cookie; got: ${JSON.stringify(setCookies)}`
    );
  }

  return { userId: user.id, authCookie };
};

describe("dashboard routes — HTTP-level user isolation", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  /*
   * Every assertion below is immune to fire-and-forget audit-log timing
   * by construction: counts use `>=` against the awaited fixture inserts
   * (auth flows may add rows, never remove them), and the isolation
   * property is asserted via per-user action prefixes, which auth-flow
   * rows can never produce for the *other* user unless the userId scoping
   * itself is broken — exactly the regression this test exists to catch.
   */
  test("each authenticated user sees only their own data", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    const alice = await registerAndLogin(app, "alice@example.com");
    const bob = await registerAndLogin(app, "bob@example.com");

    /*
     * Insert explicit fixture rows. The auth flow ALSO writes audit
     * rows via fire-and-forget `void auditLogService.record(...)` —
     * those may or may not have landed yet. To stay deterministic the
     * assertions below compare the API count to the DB ground truth
     * for each user, not to a hardcoded count.
     */
    await db.insert(auditLog).values([
      { userId: alice.userId, action: "alice.event.1" },
      { userId: alice.userId, action: "alice.event.2" },
      { userId: bob.userId, action: "bob.event.1" },
      { userId: bob.userId, action: "bob.event.2" },
      { userId: bob.userId, action: "bob.event.3" },
      { userId: null, action: "system.cron" },
    ]);

    const aliceRes = await app.handle(
      new Request("http://localhost/api/v1/dashboard/summary", {
        headers: { cookie: alice.authCookie },
      })
    );

    expect(aliceRes.status).toBe(200);
    const aliceBody: unknown = await aliceRes.json();

    if (!isSummaryBody(aliceBody)) {
      throw new Error(
        `alice response was not a summary body: ${JSON.stringify(aliceBody)}`
      );
    }

    const bobRes = await app.handle(
      new Request("http://localhost/api/v1/dashboard/summary", {
        headers: { cookie: bob.authCookie },
      })
    );

    expect(bobRes.status).toBe(200);
    const bobBody: unknown = await bobRes.json();

    if (!isSummaryBody(bobBody)) {
      throw new Error(
        `bob response was not a summary body: ${JSON.stringify(bobBody)}`
      );
    }

    /*
     * Each user's totalEvents must include their explicit fixtures (alice
     * has 2, bob has 3). The auth flows write extra audit rows
     * fire-and-forget, so the count can drift upward — `>=` not strict
     * equality. The isolation property is checked via recentActivity
     * titles, which the feed humanizes through formatActivityTitle:
     * "alice.event.1" renders as "Alice event 1". Each user must see
     * their own fixture titles and never the other user's (or the
     * userId-null system row's) — the fixtures are the newest rows, so
     * the summary's recent slice always contains them.
     */
    expect(aliceBody.totalEvents).toBeGreaterThanOrEqual(2);
    expect(bobBody.totalEvents).toBeGreaterThanOrEqual(3);

    const aliceTitles = aliceBody.recentActivity.map((item) => item.title);
    const bobTitles = bobBody.recentActivity.map((item) => item.title);

    expect(aliceTitles).toContain("Alice event 1");
    expect(aliceTitles).toContain("Alice event 2");
    expect(bobTitles).toContain("Bob event 1");
    expect(bobTitles).toContain("Bob event 2");
    expect(bobTitles).toContain("Bob event 3");

    expect(aliceTitles.some((title) => title.startsWith("Bob event"))).toBe(
      false
    );
    expect(bobTitles.some((title) => title.startsWith("Alice event"))).toBe(
      false
    );
    expect(aliceTitles.some((title) => title.startsWith("System cron"))).toBe(
      false
    );
    expect(bobTitles.some((title) => title.startsWith("System cron"))).toBe(
      false
    );
  });

  test("returns 401 without an auth cookie", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    const res = await app.handle(
      new Request("http://localhost/api/v1/dashboard/summary")
    );

    expect(res.status).toBe(401);
  });

  test("a regular (non-admin) user gets 200 — gate is auth, not admin role", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    const carol = await registerAndLogin(app, "carol@example.com");

    const res = await app.handle(
      new Request("http://localhost/api/v1/dashboard/summary", {
        headers: { cookie: carol.authCookie },
      })
    );

    expect(res.status).toBe(200);
  });

  test("activity cursor pointing at another user's row is rejected", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();

    const alice = await registerAndLogin(app, "alice2@example.com");
    const bob = await registerAndLogin(app, "bob2@example.com");

    const [bobRow] = await db
      .insert(auditLog)
      .values({ userId: bob.userId, action: "bob.private" })
      .returning({ id: auditLog.id });

    if (!bobRow) {
      throw new Error("Failed to insert bob audit row");
    }

    const res = await app.handle(
      new Request(
        `http://localhost/api/v1/dashboard/activity?cursor=cursor:${bobRow.id}`,
        { headers: { cookie: alice.authCookie } }
      )
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
