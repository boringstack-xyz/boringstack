import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import {
  applyResendEvent,
  extractResendHeaders,
  resendEventToReason,
  verifyResendWebhook,
} from "../../../src/api/webhooks/resend.utils";
import { EMAIL_SUPPRESSION_REASONS } from "../../../src/lib/email";
import {
  cleanDatabase,
  db,
  emailSuppression,
  requireDb,
} from "../../helpers/db";

const SECRET_RAW = Buffer.from("supersecret-test-key-1234567890").toString(
  "base64"
);
const WHSEC = `whsec_${SECRET_RAW}`;

const signResendBody = (
  body: string,
  svixId: string,
  timestamp: string
): string => {
  const signedContent = `${svixId}.${timestamp}.${body}`;
  const decodedSecret = Buffer.from(SECRET_RAW, "base64");
  const hmac = createHmac("sha256", decodedSecret)
    .update(signedContent)
    .digest("base64");

  return `v1,${hmac}`;
};

const NOW_SECONDS = 1_700_000_000;
const NOW_MS = NOW_SECONDS * 1000;
const BOUNCED_EVENT_TYPE = "email.bounced";

describe("extractResendHeaders", () => {
  test("returns the trio when all three svix headers are present", () => {
    const headers = extractResendHeaders({
      "svix-id": "msg_test",
      "svix-timestamp": String(NOW_SECONDS),
      "svix-signature": "v1,sig",
    });

    expect(headers.svixId).toBe("msg_test");
    expect(headers.svixTimestamp).toBe(String(NOW_SECONDS));
    expect(headers.svixSignature).toBe("v1,sig");
  });

  test("throws when any header is missing", () => {
    expect(() =>
      extractResendHeaders({
        "svix-id": "msg_test",
        "svix-timestamp": String(NOW_SECONDS),
      })
    ).toThrow();
  });
});

describe("verifyResendWebhook", () => {
  const body = JSON.stringify({
    type: BOUNCED_EVENT_TYPE,
    data: {
      email_id: "msg_1",
      to: ["x@example.com"],
      bounce: { type: "Permanent", message: "User unknown" },
    },
  });
  const svixId = "msg_test";
  const timestamp = String(NOW_SECONDS);

  test("returns the parsed event when the signature matches", () => {
    const signature = signResendBody(body, svixId, timestamp);
    const event = verifyResendWebhook(
      body,
      { svixId, svixTimestamp: timestamp, svixSignature: signature },
      { secret: WHSEC, now: () => NOW_MS }
    );

    expect(event.type).toBe(BOUNCED_EVENT_TYPE);
  });

  test("accepts rotated signatures — any v1 entry matching is sufficient", () => {
    const signature = signResendBody(body, svixId, timestamp);
    const headerWithRotation = `v1,deadbeef ${signature}`;
    const event = verifyResendWebhook(
      body,
      {
        svixId,
        svixTimestamp: timestamp,
        svixSignature: headerWithRotation,
      },
      { secret: WHSEC, now: () => NOW_MS }
    );

    expect(event.type).toBe(BOUNCED_EVENT_TYPE);
  });

  test("rejects a tampered body", () => {
    const signature = signResendBody(body, svixId, timestamp);
    const tampered = body.replace("x@example.com", "y@example.com");

    expect(() =>
      verifyResendWebhook(
        tampered,
        { svixId, svixTimestamp: timestamp, svixSignature: signature },
        { secret: WHSEC, now: () => NOW_MS }
      )
    ).toThrow();
  });

  test("rejects stale timestamps outside the tolerance window", () => {
    const oldTimestamp = String(NOW_SECONDS - 600);
    const signature = signResendBody(body, svixId, oldTimestamp);

    expect(() =>
      verifyResendWebhook(
        body,
        { svixId, svixTimestamp: oldTimestamp, svixSignature: signature },
        { secret: WHSEC, now: () => NOW_MS, toleranceSeconds: 60 }
      )
    ).toThrow();
  });

  test("rejects a header without any v1 signature entry", () => {
    expect(() =>
      verifyResendWebhook(
        body,
        {
          svixId,
          svixTimestamp: timestamp,
          svixSignature: "v0,oldscheme",
        },
        { secret: WHSEC, now: () => NOW_MS }
      )
    ).toThrow();
  });

  test("rejects non-JSON bodies", () => {
    const signature = signResendBody("not json", svixId, timestamp);

    expect(() =>
      verifyResendWebhook(
        "not json",
        { svixId, svixTimestamp: timestamp, svixSignature: signature },
        { secret: WHSEC, now: () => NOW_MS }
      )
    ).toThrow();
  });
});

describe("resendEventToReason", () => {
  test("maps email.complained to complaint", () => {
    expect(resendEventToReason({ type: "email.complained", data: {} })).toBe(
      EMAIL_SUPPRESSION_REASONS.COMPLAINT
    );
  });

  test("maps a hard email.bounced to hard_bounce", () => {
    expect(
      resendEventToReason({
        type: BOUNCED_EVENT_TYPE,
        data: { bounce: { type: "HardBounce" } },
      })
    ).toBe(EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE);
  });

  test("returns null for soft bounces — let BullMQ retry handle them", () => {
    expect(
      resendEventToReason({
        type: BOUNCED_EVENT_TYPE,
        data: { bounce: { type: "Transient" } },
      })
    ).toBeNull();
  });

  test("returns null for unrelated event types", () => {
    expect(
      resendEventToReason({ type: "email.delivered", data: {} })
    ).toBeNull();
    expect(resendEventToReason({ type: "email.opened", data: {} })).toBeNull();
  });
});

describe("applyResendEvent", () => {
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

  test("persists a suppression row for a hard bounce", async () => {
    if (!(await requireDb())) {
      return;
    }

    const recorded = await applyResendEvent({
      type: BOUNCED_EVENT_TYPE,
      data: {
        email_id: "msg_99",
        to: ["bouncer@example.com"],
        bounce: { type: "HardBounce", message: "User unknown" },
      },
    });

    expect(recorded).toBe(1);

    const rows = await db.select().from(emailSuppression);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("bouncer@example.com");
    expect(rows[0]?.providerMessageId).toBe("msg_99");
  });

  test("is idempotent — replaying the same event records zero new rows", async () => {
    if (!(await requireDb())) {
      return;
    }

    const event = {
      type: BOUNCED_EVENT_TYPE,
      data: {
        email_id: "msg_idemp",
        to: ["dup@example.com"],
        bounce: { type: "HardBounce" },
      },
    };

    expect(await applyResendEvent(event)).toBe(1);
    expect(await applyResendEvent(event)).toBe(0);
  });

  test("skips events whose recipient address is missing", async () => {
    if (!(await requireDb())) {
      return;
    }

    const recorded = await applyResendEvent({
      type: BOUNCED_EVENT_TYPE,
      data: { bounce: { type: "HardBounce" } },
    });

    expect(recorded).toBe(0);

    const rows = await db.select().from(emailSuppression);

    expect(rows).toHaveLength(0);
  });
});
