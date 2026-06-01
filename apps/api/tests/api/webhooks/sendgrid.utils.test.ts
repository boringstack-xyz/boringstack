import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";

import {
  applySendGridEvent,
  extractSendGridHeaders,
  sendGridEventToReason,
  verifySendGridWebhook,
} from "../../../src/api/webhooks/sendgrid.utils";
import { EMAIL_SUPPRESSION_REASONS } from "../../../src/lib/email";
import {
  cleanDatabase,
  db,
  emailSuppression,
  requireDb,
} from "../../helpers/db";

interface ITestKeyPair {
  publicKeyPem: string;
  privateKey: KeyObject;
}

const makeKeyPair = (): ITestKeyPair => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    privateKey,
  };
};

const signSendGridBody = (
  body: string,
  timestamp: string,
  privateKey: KeyObject
): string => {
  const signer = createSign("sha256");

  signer.update(`${timestamp}${body}`);
  signer.end();

  return signer
    .sign({ key: privateKey, dsaEncoding: "der" })
    .toString("base64");
};

const NOW_SECONDS = 1_700_000_000;
const NOW_MS = NOW_SECONDS * 1000;

describe("extractSendGridHeaders", () => {
  test("returns both signed-event headers when present", () => {
    const headers = extractSendGridHeaders({
      "x-twilio-email-event-webhook-signature": "sig",
      "x-twilio-email-event-webhook-timestamp": String(NOW_SECONDS),
    });

    expect(headers.signature).toBe("sig");
    expect(headers.timestamp).toBe(String(NOW_SECONDS));
  });

  test("throws when either header is missing", () => {
    expect(() =>
      extractSendGridHeaders({
        "x-twilio-email-event-webhook-signature": "sig",
      })
    ).toThrow();
  });
});

describe("verifySendGridWebhook", () => {
  test("returns the parsed events when the signature matches", () => {
    const { publicKeyPem, privateKey } = makeKeyPair();
    const body = JSON.stringify([
      { event: "bounce", type: "bounce", email: "x@example.com" },
    ]);
    const timestamp = String(NOW_SECONDS);
    const signature = signSendGridBody(body, timestamp, privateKey);
    const events = verifySendGridWebhook(
      body,
      { signature, timestamp },
      { publicKeyPem, now: () => NOW_MS }
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("bounce");
  });

  test("rejects a tampered body", () => {
    const { publicKeyPem, privateKey } = makeKeyPair();
    const body = JSON.stringify([{ event: "bounce" }]);
    const timestamp = String(NOW_SECONDS);
    const signature = signSendGridBody(body, timestamp, privateKey);
    const tampered = JSON.stringify([{ event: "delivered" }]);

    expect(() =>
      verifySendGridWebhook(
        tampered,
        { signature, timestamp },
        { publicKeyPem, now: () => NOW_MS }
      )
    ).toThrow();
  });

  test("rejects a signature produced by a different key", () => {
    const { publicKeyPem } = makeKeyPair();
    const { privateKey: otherKey } = makeKeyPair();
    const body = JSON.stringify([{ event: "bounce" }]);
    const timestamp = String(NOW_SECONDS);
    const signature = signSendGridBody(body, timestamp, otherKey);

    expect(() =>
      verifySendGridWebhook(
        body,
        { signature, timestamp },
        { publicKeyPem, now: () => NOW_MS }
      )
    ).toThrow();
  });

  test("rejects stale timestamps outside the tolerance", () => {
    const { publicKeyPem, privateKey } = makeKeyPair();
    const body = JSON.stringify([{ event: "bounce" }]);
    const oldTimestamp = String(NOW_SECONDS - 1200);
    const signature = signSendGridBody(body, oldTimestamp, privateKey);

    expect(() =>
      verifySendGridWebhook(
        body,
        { signature, timestamp: oldTimestamp },
        { publicKeyPem, now: () => NOW_MS, toleranceSeconds: 60 }
      )
    ).toThrow();
  });

  test("rejects a non-array body", () => {
    const { publicKeyPem, privateKey } = makeKeyPair();
    const body = JSON.stringify({ event: "bounce" });
    const timestamp = String(NOW_SECONDS);
    const signature = signSendGridBody(body, timestamp, privateKey);

    expect(() =>
      verifySendGridWebhook(
        body,
        { signature, timestamp },
        { publicKeyPem, now: () => NOW_MS }
      )
    ).toThrow();
  });
});

describe("sendGridEventToReason", () => {
  test("maps spamreport to complaint", () => {
    expect(sendGridEventToReason({ event: "spamreport" })).toBe(
      EMAIL_SUPPRESSION_REASONS.COMPLAINT
    );
  });

  test("maps bounce type=bounce to hard_bounce", () => {
    expect(sendGridEventToReason({ event: "bounce", type: "bounce" })).toBe(
      EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE
    );
  });

  test("maps bounce type=blocked to hard_bounce", () => {
    expect(sendGridEventToReason({ event: "bounce", type: "blocked" })).toBe(
      EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE
    );
  });

  test("maps dropped events with a bounced-address reason to hard_bounce", () => {
    expect(
      sendGridEventToReason({
        event: "dropped",
        reason: "Bounced Address",
      })
    ).toBe(EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE);
  });

  test("returns null for soft / transient drops without a hard reason", () => {
    expect(
      sendGridEventToReason({ event: "dropped", reason: "Spam Content" })
    ).toBeNull();
    expect(sendGridEventToReason({ event: "deferred" })).toBeNull();
    expect(sendGridEventToReason({ event: "delivered" })).toBeNull();
  });
});

describe("applySendGridEvent", () => {
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

  test("persists a row for a bounce event with a recipient", async () => {
    if (!(await requireDb())) {
      return;
    }

    const recorded = await applySendGridEvent({
      event: "bounce",
      type: "bounce",
      email: "bouncer@example.com",
      sg_message_id: "abc.123",
      status: "5.1.1",
    });

    expect(recorded).toBe(1);

    const rows = await db.select().from(emailSuppression);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("bouncer@example.com");
    expect(rows[0]?.providerMessageId).toBe("abc.123");
  });

  test("skips events with no recipient address", async () => {
    if (!(await requireDb())) {
      return;
    }

    const recorded = await applySendGridEvent({
      event: "bounce",
      type: "bounce",
    });

    expect(recorded).toBe(0);
  });
});
