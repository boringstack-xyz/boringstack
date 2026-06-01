import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanDatabase,
  db,
  eq,
  notificationPreference,
  requireDb,
  users,
} from "../../../helpers/db";
import { notificationPreferencesService } from "../../../../src/lib/notifications";

const insertTestUser = async (suffix: string): Promise<string> => {
  const [created] = await db
    .insert(users)
    .values({
      email: `prefs-${suffix}@example.com`,
      firstName: "P",
      lastName: "S",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert test user");
  }

  return created.id;
};

describe("NotificationPreferencesService.listForUser", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns an empty list when no preferences are stored", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("empty");
    const rows = await notificationPreferencesService.listForUser(userId);

    expect(rows).toEqual([]);
  });

  test("returns only rows belonging to the requesting user", async () => {
    if (!(await requireDb())) {
      return;
    }

    const me = await insertTestUser("me");
    const other = await insertTestUser("other");

    await db.insert(notificationPreference).values([
      {
        userId: me,
        eventType: "test.evt",
        channel: "email",
        enabled: false,
      },
      {
        userId: other,
        eventType: "test.evt",
        channel: "email",
        enabled: true,
      },
    ]);

    const rows = await notificationPreferencesService.listForUser(me);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventType: "test.evt",
      channel: "email",
      enabled: false,
    });
  });
});

describe("NotificationPreferencesService.update", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("inserts new preference rows and returns the user's full set", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("insert");

    const result = await notificationPreferencesService.update({
      userId,
      preferences: [
        { eventType: "test.evt", channel: "email", enabled: false },
        { eventType: "test.evt", channel: "in-app", enabled: true },
      ],
    });

    expect(result).toHaveLength(2);
    const persisted = await db
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, userId));

    expect(persisted).toHaveLength(2);
  });

  test("updates an existing row instead of inserting a duplicate", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("upsert");

    await notificationPreferencesService.update({
      userId,
      preferences: [{ eventType: "test.evt", channel: "email", enabled: true }],
    });
    await notificationPreferencesService.update({
      userId,
      preferences: [
        { eventType: "test.evt", channel: "email", enabled: false },
      ],
    });

    const rows = await db
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.enabled).toBe(false);
  });

  test("empty preferences array is a no-op that returns the current set", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("noop");

    const result = await notificationPreferencesService.update({
      userId,
      preferences: [],
    });

    expect(result).toEqual([]);
  });
});

describe("NotificationPreferencesService.resolveEnabledChannels", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  afterEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("every candidate is enabled when no preference rows exist", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("default");

    const result = await notificationPreferencesService.resolveEnabledChannels({
      userId,
      eventType: "test.evt",
      candidates: ["in-app", "email"],
    });

    expect(result.enabled).toEqual(["in-app", "email"]);
    expect(result.disabled).toEqual([]);
  });

  test("a disabled preference row pushes the channel to `disabled`", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("partial");

    await db.insert(notificationPreference).values({
      userId,
      eventType: "test.evt",
      channel: "email",
      enabled: false,
    });

    const result = await notificationPreferencesService.resolveEnabledChannels({
      userId,
      eventType: "test.evt",
      candidates: ["in-app", "email"],
    });

    expect(result.enabled).toEqual(["in-app"]);
    expect(result.disabled).toEqual(["email"]);
  });

  test("an explicit `enabled=true` row stays in `enabled` (same as default)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("explicit");

    await db.insert(notificationPreference).values({
      userId,
      eventType: "test.evt",
      channel: "in-app",
      enabled: true,
    });

    const result = await notificationPreferencesService.resolveEnabledChannels({
      userId,
      eventType: "test.evt",
      candidates: ["in-app"],
    });

    expect(result.enabled).toEqual(["in-app"]);
    expect(result.disabled).toEqual([]);
  });

  test("empty candidates returns empty enabled/disabled", async () => {
    if (!(await requireDb())) {
      return;
    }

    const userId = await insertTestUser("empty-candidates");

    const result = await notificationPreferencesService.resolveEnabledChannels({
      userId,
      eventType: "test.evt",
      candidates: [],
    });

    expect(result.enabled).toEqual([]);
    expect(result.disabled).toEqual([]);
  });
});
