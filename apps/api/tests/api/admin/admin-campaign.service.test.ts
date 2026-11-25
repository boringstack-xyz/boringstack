import { beforeEach, describe, expect, test } from "bun:test";

import { AdminCampaignService } from "../../../src/api/admin/admin-campaign.service";
import {
  lifecycleService,
  signUnsubscribeToken,
} from "../../../src/api/lifecycle";
import { env } from "../../../src/config/env";
import { SYNTHETIC_EMAIL_DOMAIN } from "../../../src/lib/synthetic";
import { seedVerifiedUser } from "../../helpers/auth";
import { cleanDatabase, db, requireDb, users, eq } from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";

interface IEnqueued {
  data: { recipientUserId: string; eventType: string };
  jobId: string;
}

const consent = async (userId: string, value: string | null) => {
  await db
    .update(users)
    .set({ marketingConsentAt: value })
    .where(eq(users.id, userId));
};

describe("AdminCampaignService", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("the segment is consented, verified, non-robot people only", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operator = await seedVerifiedUser({
      email: "op@example.com",
      password: PASSWORD,
      isPlatformAdmin: true,
    });
    const reached = await seedVerifiedUser({
      email: "reached@example.com",
      password: PASSWORD,
    });

    await seedVerifiedUser({
      email: "silent@example.com",
      password: PASSWORD,
    });
    const robot = await seedVerifiedUser({
      email: `robot@${SYNTHETIC_EMAIL_DOMAIN}`,
      password: PASSWORD,
    });

    await consent(reached.user.id, "2026-11-01T00:00:00.000Z");
    await consent(robot.user.id, "2026-11-01T00:00:00.000Z");

    const service = new AdminCampaignService(() => Promise.resolve());
    const draft = await service.create({
      subject: "News",
      body: "Hello",
      operatorUserId: operator.user.id,
    });
    const preview = await service.preview(draft.id);

    expect(preview.recipientCount).toBe(1);
    expect(preview.truncated).toBe(false);
  });

  test("send enqueues once per consented person and refuses a second send", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operator = await seedVerifiedUser({
      email: "op2@example.com",
      password: PASSWORD,
      isPlatformAdmin: true,
    });
    const person = await seedVerifiedUser({
      email: "fan@example.com",
      password: PASSWORD,
      firstName: "Fan",
    });

    await consent(person.user.id, "2026-11-01T00:00:00.000Z");

    const enqueued: IEnqueued[] = [];
    const service = new AdminCampaignService((data, jobId) => {
      enqueued.push({ data, jobId });

      return Promise.resolve();
    });

    const draft = await service.create({
      subject: "News",
      body: "Line one\nLine two",
      operatorUserId: operator.user.id,
    });

    const sent = await service.send(draft.id, operator.user.id);

    expect(sent.status).toBe("sent");
    expect(sent.recipientCount).toBe(1);
    expect(sent.failedCount).toBe(0);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.data.eventType).toBe("campaign.message");
    expect(enqueued[0]?.data.recipientUserId).toBe(person.user.id);
    expect(enqueued[0]?.jobId).toBe(`campaign:${draft.id}:${person.user.id}`);

    let thrown: unknown = null;

    try {
      await service.send(draft.id, operator.user.id);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).toMatch(/already sent/u);
    expect(enqueued).toHaveLength(1);
  });

  test("unsubscribing withdraws consent, so the next campaign skips the person", async () => {
    if (!(await requireDb())) {
      return;
    }

    const operator = await seedVerifiedUser({
      email: "op3@example.com",
      password: PASSWORD,
      isPlatformAdmin: true,
    });
    const person = await seedVerifiedUser({
      email: "leaver@example.com",
      password: PASSWORD,
    });

    await consent(person.user.id, "2026-11-01T00:00:00.000Z");

    const token = signUnsubscribeToken(person.user.id, env.JWT_SECRET);

    expect(await lifecycleService.unsubscribe(token)).toBe(true);

    const enqueued: IEnqueued[] = [];
    const service = new AdminCampaignService((data, jobId) => {
      enqueued.push({ data, jobId });

      return Promise.resolve();
    });
    const draft = await service.create({
      subject: "News",
      body: "Hello",
      operatorUserId: operator.user.id,
    });

    const sent = await service.send(draft.id, operator.user.id);

    expect(sent.recipientCount).toBe(0);
    expect(enqueued).toHaveLength(0);
  });
});
