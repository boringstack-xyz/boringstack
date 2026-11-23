import { describe, expect, test } from "bun:test";

import { lifecycleWelcomeFollowUpEvent } from "../../../../src/api/notifications/events/lifecycle.event";
import { Value } from "@sinclair/typebox/value";

const PAYLOAD = {
  firstName: "Sam",
  ctaUrl: "https://app.example.com/dashboard?utm_source=email",
  unsubscribeUrl:
    "https://api.example.com/api/v1/lifecycle/unsubscribe?token=t",
  replyTo: "",
};

describe("lifecycleWelcomeFollowUpEvent", () => {
  test("is registered under the lifecycle event prefix", () => {
    expect(lifecycleWelcomeFollowUpEvent.type).toBe(
      "lifecycle.welcome-follow-up"
    );
  });

  test("its payload schema accepts the sweep's payload", () => {
    expect(Value.Check(lifecycleWelcomeFollowUpEvent.schema, PAYLOAD)).toBe(
      true
    );
  });

  test("the email carries the unsubscribe link and the List-Unsubscribe headers", () => {
    const email = lifecycleWelcomeFollowUpEvent.render.email;

    expect(email).toBeDefined();

    const ctx = { recipientUserId: "u1", payload: PAYLOAD };
    const variables = email?.variables?.(ctx);
    const envelope = email?.envelope?.(ctx);

    expect(variables).toMatchObject({
      firstName: "Sam",
      unsubscribeUrl: PAYLOAD.unsubscribeUrl,
      canReply: false,
    });
    expect(envelope?.headers?.["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
    expect(envelope?.replyTo).toBeUndefined();
  });

  test("an empty first name greets the person as there", () => {
    const email = lifecycleWelcomeFollowUpEvent.render.email;
    const variables = email?.variables?.({
      recipientUserId: "u1",
      payload: { ...PAYLOAD, firstName: "" },
    });

    expect(variables).toMatchObject({ firstName: "there" });
  });

  test("dedups per recipient for a century, so it is sent once ever", () => {
    expect(lifecycleWelcomeFollowUpEvent.dedup?.windowSeconds).toBeGreaterThan(
      90 * 365 * 24 * 3600
    );
    expect(
      lifecycleWelcomeFollowUpEvent.dedup?.key({
        recipientUserId: "u1",
        payload: PAYLOAD,
      })
    ).toBe("lifecycle:welcome-follow-up:u1");
  });
});
