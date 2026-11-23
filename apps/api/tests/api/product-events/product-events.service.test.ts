import { beforeEach, describe, expect, test } from "bun:test";

import { productEventsService } from "../../../src/api/product-events/product-events.service";
import { seedVerifiedUser } from "../../helpers/auth";
import { cleanDatabase, db, productEvents, requireDb } from "../../helpers/db";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("product events service", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("the retention sweep removes events older than 365 days and keeps recent ones", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "retention@example.com",
    });
    const old = new Date(Date.now() - 400 * DAY_MS).toISOString();
    const recent = new Date(Date.now() - 10 * DAY_MS).toISOString();

    await db.insert(productEvents).values([
      {
        accountId: account.id,
        userId: user.id,
        kind: "feedback_given",
        createdAt: old,
        updatedAt: old,
      },
      {
        accountId: account.id,
        userId: user.id,
        kind: "feedback_given",
        createdAt: recent,
        updatedAt: recent,
      },
    ]);

    expect(await productEventsService.pruneExpired()).toBe(1);

    const remaining = await db.select().from(productEvents);

    expect(remaining).toHaveLength(1);
    expect(Date.parse(remaining[0]?.createdAt ?? "")).toBe(Date.parse(recent));
  });
});
