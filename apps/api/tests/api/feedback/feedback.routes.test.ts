import { beforeEach, describe, expect, test } from "bun:test";

import { createApp } from "../../../src/config/app";
import { seedVerifiedUser } from "../../helpers/auth";
import {
  cleanDatabase,
  db,
  eq,
  feedbackAnswers,
  requireDb,
} from "../../helpers/db";

const PASSWORD = "Hunter2Strong!";
const ROBOT_DOMAIN = "robot.boringstack.invalid";
const SHOW_ONBOARDED = "/onboarded/show";

const findAuthCookie = (setCookies: readonly string[]): string => {
  const raw = setCookies.find((value) => value.startsWith("auth_token="));
  const semi = raw?.indexOf(";") ?? -1;

  return raw === undefined ? "" : semi === -1 ? raw : raw.slice(0, semi);
};

const loginCookie = async (
  app: ReturnType<typeof createApp>,
  email: string
): Promise<{ userId: string; cookie: string }> => {
  const { user } = await seedVerifiedUser({ email, password: PASSWORD });
  const res = await app.handle(
    new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  );

  return {
    userId: user.id,
    cookie: findAuthCookie(res.headers.getSetCookie()),
  };
};

const call = (
  app: ReturnType<typeof createApp>,
  cookie: string,
  method: "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<Response> =>
  app.handle(
    new Request(`http://localhost/api/v1/feedback${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );

describe("feedback routes", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("the prompt is shown once per person per moment", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const member = await loginCookie(app, "feedback-once@example.com");
    const first = await call(app, member.cookie, "POST", SHOW_ONBOARDED);
    const second = await call(app, member.cookie, "POST", SHOW_ONBOARDED);
    const otherMoment = await call(
      app,
      member.cookie,
      "POST",
      "/upgraded/show"
    );

    expect(await first.json()).toEqual({ show: true });
    expect(await second.json()).toEqual({ show: false });
    expect(await otherMoment.json()).toEqual({ show: true });
  });

  test("an answer is stored against the shown prompt", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const member = await loginCookie(app, "feedback-answer@example.com");

    await call(app, member.cookie, "POST", SHOW_ONBOARDED);

    const res = await call(app, member.cookie, "PUT", "/onboarded", {
      answer: "  Clear enough  ",
      dismissed: false,
    });

    expect(res.status).toBe(204);

    const [row] = await db
      .select()
      .from(feedbackAnswers)
      .where(eq(feedbackAnswers.userId, member.userId));

    expect(row?.state).toBe("answered");
    expect(row?.answer).toBe("Clear enough");
  });

  test("a dismissal stores no answer text", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const member = await loginCookie(app, "feedback-dismiss@example.com");

    await call(app, member.cookie, "POST", SHOW_ONBOARDED);
    await call(app, member.cookie, "PUT", "/onboarded", {
      answer: "not sent",
      dismissed: true,
    });

    const [row] = await db.select().from(feedbackAnswers);

    expect(row?.state).toBe("dismissed");
    expect(row?.answer).toBe("");
  });

  test("the verification robot is never prompted and stores nothing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const app = createApp();
    const robot = await loginCookie(
      app,
      `robot-${crypto.randomUUID()}@${ROBOT_DOMAIN}`
    );
    const res = await call(app, robot.cookie, "POST", SHOW_ONBOARDED);

    expect(await res.json()).toEqual({ show: false });
    expect(await db.select().from(feedbackAnswers)).toHaveLength(0);
  });
});
