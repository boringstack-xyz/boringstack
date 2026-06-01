import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanDatabase,
  db,
  eq,
  notificationDedup,
  requireDb,
} from "../../helpers/db";
import { dedupService } from "../../../src/lib/notifications";

const wipeDedup = async (): Promise<void> => {
  await db.delete(notificationDedup);
};

describe("DedupService.tryClaim", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    await wipeDedup();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await wipeDedup();
    await cleanDatabase();
  });

  test("returns true on first claim and inserts a row", async () => {
    if (!(await requireDb())) {
      return;
    }

    const claimed = await dedupService.tryClaim({
      dedupKey: "dedup:event:alpha",
      windowSeconds: 60,
    });

    expect(claimed).toBe(true);

    const rows = await db
      .select()
      .from(notificationDedup)
      .where(eq(notificationDedup.dedupKey, "dedup:event:alpha"));

    expect(rows).toHaveLength(1);
  });

  test("returns false on a duplicate claim within the window", async () => {
    if (!(await requireDb())) {
      return;
    }

    const first = await dedupService.tryClaim({
      dedupKey: "dedup:event:beta",
      windowSeconds: 60,
    });
    const second = await dedupService.tryClaim({
      dedupKey: "dedup:event:beta",
      windowSeconds: 60,
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  test("purgeExpired deletes rows past expiresAt and leaves fresh ones", async () => {
    if (!(await requireDb())) {
      return;
    }

    const pastIso = new Date(Date.now() - 60_000).toISOString();

    await db.insert(notificationDedup).values({
      dedupKey: "dedup:event:expired",
      expiresAt: pastIso,
    });
    await dedupService.tryClaim({
      dedupKey: "dedup:event:fresh",
      windowSeconds: 600,
    });

    const purged = await dedupService.purgeExpired();

    expect(purged).toBeGreaterThanOrEqual(1);

    const remaining = await db.select().from(notificationDedup);
    const keys = remaining.map((row) => row.dedupKey);

    expect(keys).toContain("dedup:event:fresh");
    expect(keys).not.toContain("dedup:event:expired");
  });

  test("purgeExpired returns 0 when no rows have expired", async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
    await wipeDedup();

    const purged = await dedupService.purgeExpired();

    expect(purged).toBe(0);
  });
});
