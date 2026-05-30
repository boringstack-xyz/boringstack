import { beforeEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { createApp } from "../../../src/config/app";
import { env } from "../../../src/config/env";
import {
  cleanDatabase,
  db,
  emailSuppression,
  requireDb,
} from "../../helpers/db";

const signResendBody = (
  body: string,
  svixId: string,
  timestamp: string
): string => {
  if (!env.RESEND_WEBHOOK_SECRET.startsWith("whsec_")) {
    throw new Error("Test setup: RESEND_WEBHOOK_SECRET is not configured");
  }

  const decodedSecret = Buffer.from(
    env.RESEND_WEBHOOK_SECRET.slice("whsec_".length),
    "base64"
  );
  const hmac = createHmac("sha256", decodedSecret)
    .update(`${svixId}.${timestamp}.${body}`)
    .digest("base64");

  return `v1,${hmac}`;
};

const postWebhook = async (
  app: ReturnType<typeof createApp>,
  body: string,
  headers: Record<string, string>
): Promise<Response> =>
  app.handle(
    new Request("http://localhost/api/v1/webhooks/resend", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    })
  );

describe("POST /api/v1/webhooks/resend", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("400 when svix headers are missing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const res = await postWebhook(
      createApp(),
      JSON.stringify({ type: "email.bounced" }),
      {}
    );

    expect(res.status).toBe(400);
  });

  test("401 when the signature does not match", async () => {
    if (!(await requireDb())) {
      return;
    }

    const body = JSON.stringify({
      type: "email.bounced",
      data: {
        to: ["x@example.com"],
        bounce: { type: "HardBounce" },
      },
    });

    const res = await postWebhook(createApp(), body, {
      "svix-id": "msg_x",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": "v1,deadbeef",
    });

    expect(res.status).toBe(401);
  });

  test("200 + persists suppression row on a valid hard-bounce event", async () => {
    if (!(await requireDb())) {
      return;
    }

    const timestamp = String(Math.floor(Date.now() / 1000));
    const svixId = "msg_ok";
    const body = JSON.stringify({
      type: "email.bounced",
      data: {
        email_id: "rs_msg_1",
        to: ["hardbouncer@example.com"],
        bounce: { type: "HardBounce", message: "User unknown" },
      },
    });
    const signature = signResendBody(body, svixId, timestamp);

    const res = await postWebhook(createApp(), body, {
      "svix-id": svixId,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    });

    expect(res.status).toBe(200);

    const rows = await db.select().from(emailSuppression);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("hardbouncer@example.com");
  });
});
