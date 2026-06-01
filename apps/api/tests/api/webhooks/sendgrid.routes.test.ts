import { beforeEach, describe, expect, test } from "bun:test";
import { createSign, KeyObject } from "node:crypto";

import { createApp } from "../../../src/config/app";
import {
  cleanDatabase,
  db,
  emailSuppression,
  requireDb,
} from "../../helpers/db";

const getTestPrivateKey = (): KeyObject => {
  const stash: unknown = Reflect.get(
    globalThis,
    "__SENDGRID_TEST_PRIVATE_KEY__"
  );

  if (!(stash instanceof KeyObject)) {
    throw new Error(
      "Test setup did not stash a SendGrid private key on globalThis"
    );
  }

  return stash;
};

const signSendGridBody = (body: string, timestamp: string): string => {
  const signer = createSign("sha256");

  signer.update(`${timestamp}${body}`);
  signer.end();

  return signer
    .sign({ key: getTestPrivateKey(), dsaEncoding: "der" })
    .toString("base64");
};

const postWebhook = async (
  app: ReturnType<typeof createApp>,
  body: string,
  headers: Record<string, string>
): Promise<Response> =>
  app.handle(
    new Request("http://localhost/api/v1/webhooks/sendgrid", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    })
  );

describe("POST /api/v1/webhooks/sendgrid", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("400 when signed-event headers are missing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const res = await postWebhook(createApp(), JSON.stringify([]), {});

    expect(res.status).toBe(400);
  });

  test("401 when the signature does not verify", async () => {
    if (!(await requireDb())) {
      return;
    }

    const body = JSON.stringify([
      { event: "bounce", type: "bounce", email: "x@example.com" },
    ]);
    const res = await postWebhook(createApp(), body, {
      "x-twilio-email-event-webhook-timestamp": String(
        Math.floor(Date.now() / 1000)
      ),
      "x-twilio-email-event-webhook-signature":
        Buffer.from("deadbeef").toString("base64"),
    });

    expect(res.status).toBe(401);
  });

  test("200 + persists row on a valid bounce event batch", async () => {
    if (!(await requireDb())) {
      return;
    }

    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify([
      {
        event: "bounce",
        type: "bounce",
        email: "sgbouncer@example.com",
        sg_message_id: "sg.1",
        status: "5.1.1",
      },
      { event: "delivered", email: "ok@example.com" },
    ]);
    const signature = signSendGridBody(body, timestamp);

    const res = await postWebhook(createApp(), body, {
      "x-twilio-email-event-webhook-timestamp": timestamp,
      "x-twilio-email-event-webhook-signature": signature,
    });

    expect(res.status).toBe(200);

    const rows = await db.select().from(emailSuppression);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("sgbouncer@example.com");
  });
});
