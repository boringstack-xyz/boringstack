import { beforeEach, describe, expect, test } from "bun:test";

import { feedbackService } from "../../../src/api/feedback/feedback.service";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  cleanDatabase,
  db,
  feedbackAnswers,
  requireDb,
} from "../../helpers/db";

const ROBOT_DOMAIN = "robot.boringstack.invalid";

describe("feedback service", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("a robot address claims nothing and stores nothing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: `robot-svc-${crypto.randomUUID()}@${ROBOT_DOMAIN}`,
    });
    const claimed = await feedbackService.claim(
      { accountId: account.id, userId: user.id, email: user.email },
      "onboarded"
    );

    expect(claimed).toBe(false);
    expect(await db.select().from(feedbackAnswers)).toHaveLength(0);
  });

  test("only the first claim of a moment wins", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user, account } = await seedVerifiedUser({
      email: "claim-race@example.com",
    });
    const owner = {
      accountId: account.id,
      userId: user.id,
      email: user.email,
    };
    const results = await Promise.all([
      feedbackService.claim(owner, "upgraded"),
      feedbackService.claim(owner, "upgraded"),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
