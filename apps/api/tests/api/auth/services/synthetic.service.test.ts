import { beforeEach, describe, expect, test } from "bun:test";

import { ensureBuiltInPlans } from "../../../../src/api/billing";
import { resolveAccountFeatures } from "../../../../src/lib/acl";
import { syntheticService } from "../../../../src/api/auth/services";
import { createApp } from "../../../../src/config/app";
import { env } from "../../../../src/config/env";
import { AUTH_COOKIE_NAME } from "../../../../src/lib/cookies";
import { AUDIT_ACTIONS, auditLogService } from "../../../../src/lib/audit-log";
import { sendTemplateNow } from "../../../../src/lib/email";
import {
  SYNTHETIC_EMAIL_DOMAIN,
  SYNTHETIC_SECRET_HEADER,
} from "../../../../src/lib/synthetic";
import { seedPendingUser } from "../../../helpers/auth";
import {
  accountMemberships,
  accountPlans,
  and,
  accounts,
  auditLog,
  cleanDatabase,
  db,
  eq,
  isNull,
  requireDb,
  users,
} from "../../../helpers/db";

/*
 * The verification robot's routes, which run in production. What must
 * hold: without the exact secret they do not exist, and with it they reach
 * robot addresses only.
 */
/* Set for the whole test process in tests/setup-test-env.ts; the unset case is matchesSyntheticSecret's own test. */
const SECRET = env.SYNTHETIC_CHECK_SECRET;
const ROBOT = `run-1@${SYNTHETIC_EMAIL_DOMAIN}`;
const PERSON = "person@example.com";

const call = (
  path: "verify" | "cleanup" | "upgrade",
  email: string,
  secret?: string
): Promise<Response> =>
  createApp().handle(
    new Request(`http://localhost/api/v1/auth/synthetic/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret === undefined ? {} : { [SYNTHETIC_SECRET_HEADER]: secret }),
      },
      body: JSON.stringify({ email }),
    })
  );

const status = async (
  path: "verify" | "cleanup" | "upgrade",
  email: string,
  secret?: string
): Promise<number> => {
  const res = await call(path, email, secret);

  return res.status;
};

const userRow = async (email: string) => {
  const rows = await db.select().from(users).where(eq(users.email, email));

  return rows[0];
};

const verifiedAt = async (email: string): Promise<string | null> => {
  const user = await userRow(email);

  return user?.emailVerifiedAt ?? null;
};

const accountIdOf = async (email: string): Promise<string> => {
  const user = await userRow(email);
  const rows = await db
    .select()
    .from(accountMemberships)
    .where(eq(accountMemberships.userId, user?.id ?? ""));

  return rows[0]?.accountId ?? "";
};

describe("verification robot routes", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("a missing or wrong secret answers 404 and changes nothing", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({ email: ROBOT });

    expect(SECRET.length).toBeGreaterThanOrEqual(32);
    expect(await status("verify", ROBOT)).toBe(404);
    expect(await status("verify", ROBOT, "")).toBe(404);
    expect(await status("verify", ROBOT, "w".repeat(64))).toBe(404);
    expect(await status("cleanup", ROBOT, "w".repeat(64))).toBe(404);
    expect(await verifiedAt(ROBOT)).toBeNull();
  });

  test("the right secret verifies a robot sign-up, provisions its account and signs it in", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({ email: ROBOT });

    const res = await call("verify", ROBOT, SECRET);

    expect(res.status).toBe(200);
    expect(
      res.headers
        .getSetCookie()
        .some((raw) => raw.startsWith(`${AUTH_COOKIE_NAME}=`))
    ).toBe(true);

    const user = await userRow(ROBOT);

    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(
      await db
        .select()
        .from(accountMemberships)
        .where(eq(accountMemberships.userId, user?.id ?? ""))
    ).toHaveLength(1);
  });

  test("the right secret still cannot verify or remove a real person's address", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({ email: PERSON });

    expect(await status("verify", PERSON, SECRET)).toBe(404);
    expect(await status("cleanup", PERSON, SECRET)).toBe(404);

    const user = await userRow(PERSON);

    expect(user).toBeDefined();
    expect(user?.emailVerifiedAt).toBeNull();
  });

  test("cleanup removes the robot user and the account it owns, and can be repeated", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({ email: ROBOT });
    await call("verify", ROBOT, SECRET);

    const user = await userRow(ROBOT);
    const [membership] = await db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.userId, user?.id ?? ""));

    const first = await call("cleanup", ROBOT, SECRET);

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ data: { removed: 1 } });
    expect(await userRow(ROBOT)).toBeUndefined();
    expect(
      await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, membership?.accountId ?? ""))
    ).toHaveLength(0);

    const second = await call("cleanup", ROBOT, SECRET);

    expect(await second.json()).toMatchObject({ data: { removed: 0 } });
  });

  test("upgrade puts the robot's own account on Pro, marked synthetic, and nobody else's", async () => {
    if (!(await requireDb())) {
      return;
    }

    await ensureBuiltInPlans();
    await seedPendingUser({ email: ROBOT });
    await seedPendingUser({ email: PERSON });
    await call("verify", ROBOT, SECRET);

    const accountId = await accountIdOf(ROBOT);
    const before = await resolveAccountFeatures(accountId);

    expect(before.can_export).not.toBe(true);
    expect(await status("upgrade", ROBOT)).toBe(404);
    expect(await status("upgrade", ROBOT, "w".repeat(64))).toBe(404);
    expect(await status("upgrade", PERSON, SECRET)).toBe(404);
    expect(await status("upgrade", ROBOT, SECRET)).toBe(200);
    /* Asking twice leaves one current plan, not two. */
    expect(await status("upgrade", ROBOT, SECRET)).toBe(200);

    const after = await resolveAccountFeatures(accountId);
    const current = await db
      .select()
      .from(accountPlans)
      .where(
        and(
          eq(accountPlans.accountId, accountId),
          isNull(accountPlans.revokedAt)
        )
      );

    expect(after.can_export).toBe(true);
    expect(current.map((row) => row.source)).toEqual(["synthetic"]);

    /* The plan goes with the account. */
    expect(await status("cleanup", ROBOT, SECRET)).toBe(200);
    expect(
      await db
        .select()
        .from(accountPlans)
        .where(eq(accountPlans.accountId, accountId))
    ).toHaveLength(0);
  });

  test("the leftover sweep removes old robot users and nobody else", async () => {
    if (!(await requireDb())) {
      return;
    }

    const old = new Date(Date.now() - 2 * 86_400_000).toISOString();

    await seedPendingUser({ email: ROBOT });
    await seedPendingUser({ email: `fresh@${SYNTHETIC_EMAIL_DOMAIN}` });
    await seedPendingUser({ email: PERSON });
    await db
      .update(users)
      .set({ createdAt: old })
      .where(eq(users.email, ROBOT));
    await db
      .update(users)
      .set({ createdAt: old })
      .where(eq(users.email, PERSON));

    expect(await syntheticService.sweepLeftovers()).toEqual({ swept: 1 });
    expect(await userRow(ROBOT)).toBeUndefined();
    expect(await userRow(`fresh@${SYNTHETIC_EMAIL_DOMAIN}`)).toBeDefined();
    expect(await userRow(PERSON)).toBeDefined();
  });

  test("a robot's activity is left out of the audit log; a person's is kept", async () => {
    if (!(await requireDb())) {
      return;
    }

    await seedPendingUser({ email: ROBOT });
    await seedPendingUser({ email: PERSON });

    const robot = await userRow(ROBOT);
    const person = await userRow(PERSON);

    await auditLogService.record({
      userId: robot?.id ?? "",
      action: AUDIT_ACTIONS.AUTH_REGISTER,
    });
    await auditLogService.record({
      userId: person?.id ?? "",
      action: AUDIT_ACTIONS.AUTH_REGISTER,
    });

    const rows = await db.select().from(auditLog);

    expect(rows.map((row) => row.userId)).toEqual([person?.id ?? ""]);
  });

  test("no email is ever sent to a robot address", async () => {
    expect(
      await sendTemplateNow({
        to: ROBOT,
        subject: "Confirm your email",
        templatePath: "does/not/matter",
        variables: {},
      })
    ).toEqual({ status: "suppressed", reason: "manual" });
  });
});
