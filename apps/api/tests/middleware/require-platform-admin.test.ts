import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { errorHandler } from "../../src/middleware/error-handler";
import { requirePlatformAdmin } from "../../src/middleware/require-platform-admin";
import { AUTH_COOKIE_NAME } from "../../src/lib/cookies";
import { AUDIT_ACTIONS } from "../../src/lib/audit-log";
import { buildJWTPayload, createJWTConfig } from "../../src/lib/jwt";
import { seedVerifiedUser } from "../helpers/auth";
import { auditLog, cleanDatabase, db, eq, requireDb } from "../helpers/db";

const ADMIN_ONLY_URL = "http://localhost/admin-only";

const buildApp = () =>
  new Elysia()
    .onError(({ code, error, set }) =>
      errorHandler({ code: String(code), error, set })
    )
    .use(requirePlatformAdmin().get("/admin-only", () => ({ ok: true })));

const signCookie = async (
  userId: string,
  email: string,
  accountId: string
): Promise<string> => {
  const plugin = createJWTConfig();
  const ctx = plugin.decorator.jwt;
  const token = await ctx.sign(await buildJWTPayload(userId, email, accountId));

  return `${AUTH_COOKIE_NAME}=${token}`;
};

const waitForAuditAction = async (action: string): Promise<boolean> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, action));

    if (rows.length > 0) {
      return true;
    }

    await Bun.sleep(10);
  }

  return false;
};

describe("requirePlatformAdmin middleware", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("401 when no auth cookie is present", async () => {
    if (!(await requireDb())) {
      return;
    }

    const res = await buildApp().handle(new Request(ADMIN_ONLY_URL));

    expect(res.status).toBe(401);
  });

  test("403 for an authenticated non-platform-admin user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "not-admin@example.com",
    });
    const cookie = await signCookie(user.id, user.email, account.id);

    const res = await buildApp().handle(
      new Request(ADMIN_ONLY_URL, { headers: { cookie } })
    );

    expect(res.status).toBe(403);
  });

  test("200 for a platform-admin user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "platform-admin@example.com",
      isPlatformAdmin: true,
    });
    const cookie = await signCookie(user.id, user.email, account.id);

    const res = await buildApp().handle(
      new Request(ADMIN_ONLY_URL, { headers: { cookie } })
    );

    expect(res.status).toBe(200);
  });

  test("response body contains {ok: true} on success", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "platform-admin-body@example.com",
      isPlatformAdmin: true,
    });
    const cookie = await signCookie(user.id, user.email, account.id);

    const res = await buildApp().handle(
      new Request(ADMIN_ONLY_URL, { headers: { cookie } })
    );

    expect(res.status).toBe(200);

    const body: unknown = await res.json();

    expect(body).toEqual({ ok: true });
  });

  test("audits successful platform-admin bypasses", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "platform-admin-audit@example.com",
      isPlatformAdmin: true,
    });
    const cookie = await signCookie(user.id, user.email, account.id);

    const res = await buildApp().handle(
      new Request(ADMIN_ONLY_URL, { headers: { cookie } })
    );

    expect(res.status).toBe(200);
    expect(
      await waitForAuditAction(AUDIT_ACTIONS.AUTHZ_PLATFORM_ADMIN_BYPASS)
    ).toBe(true);
  });
});
