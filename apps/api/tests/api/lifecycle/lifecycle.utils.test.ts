import { describe, expect, test } from "bun:test";

import { env } from "../../../src/config/env";
import {
  apiRoot,
  lifecycleEmailEnvelope,
  signUnsubscribeToken,
  unsubscribePage,
  unsubscribeUrl,
  verifyUnsubscribeToken,
  withEmailUtm,
} from "../../../src/api/lifecycle/lifecycle.utils";

const USER_ID = "3f0c8a52-6d1e-4b7a-9c2e-1a2b3c4d5e6f";
const SECRET = "x".repeat(32);

describe("unsubscribe tokens", () => {
  test("a token verifies to the user it was issued for", () => {
    const token = signUnsubscribeToken(USER_ID, SECRET);

    expect(verifyUnsubscribeToken(token, SECRET)).toBe(USER_ID);
  });

  test("a token signed with another secret is refused", () => {
    const token = signUnsubscribeToken(USER_ID, SECRET);

    expect(verifyUnsubscribeToken(token, "y".repeat(32))).toBeNull();
  });

  test("a token with a swapped user id is refused", () => {
    const token = signUnsubscribeToken(USER_ID, SECRET);
    const [, signature] = token.split(".");
    const forged = `3f0c8a52-6d1e-4b7a-9c2e-000000000000.${signature ?? ""}`;

    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull();
  });

  test("malformed tokens are refused without throwing", () => {
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("not-a-uuid.abc", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(USER_ID, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${USER_ID}.abc.extra`, SECRET)).toBeNull();
  });
});

describe("unsubscribe URL and links", () => {
  test("apiRoot drops a trailing slash and an /api suffix", () => {
    expect(apiRoot("https://api.example.com/")).toBe("https://api.example.com");
    expect(apiRoot("https://api.example.com/api")).toBe(
      "https://api.example.com"
    );
  });

  test("unsubscribeUrl points at the public lifecycle route and encodes the token", () => {
    expect(unsubscribeUrl("https://api.example.com/api", "a.b+c")).toBe(
      "https://api.example.com/api/v1/lifecycle/unsubscribe?token=a.b%2Bc"
    );
  });

  test("withEmailUtm tags the link with the stage as campaign", () => {
    const url = withEmailUtm(
      "https://app.example.com/dashboard",
      "welcome-follow-up"
    );

    expect(url).toContain("utm_source=email");
    expect(url).toContain("utm_medium=lifecycle");
    expect(url).toContain("utm_campaign=welcome-follow-up");
  });
});

describe("lifecycleEmailEnvelope", () => {
  test("carries the one-click List-Unsubscribe headers (RFC 8058)", () => {
    const envelope = lifecycleEmailEnvelope({
      unsubscribeUrl:
        "https://api.example.com/api/v1/lifecycle/unsubscribe?token=t",
      replyTo: "",
    });

    expect(envelope.headers).toEqual({
      "List-Unsubscribe":
        "<https://api.example.com/api/v1/lifecycle/unsubscribe?token=t>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(envelope.fromName).toBe(env.APP_NAME);
    expect(envelope.replyTo).toBeUndefined();
  });

  test("adds a reply-to only when one is configured", () => {
    const envelope = lifecycleEmailEnvelope({
      unsubscribeUrl: "https://api.example.com/u",
      replyTo: "hello@example.com",
    });

    expect(envelope.replyTo).toBe("hello@example.com");
  });
});

describe("unsubscribePage", () => {
  test("the confirm page posts to the action URL and never unsubscribes on GET", () => {
    const html = unsubscribePage({
      state: "confirm",
      actionUrl: "https://api.example.com/api/v1/lifecycle/unsubscribe?token=t",
      appUrl: "https://app.example.com",
    });

    expect(html).toContain('method="post"');
    expect(html).toContain(
      'action="https://api.example.com/api/v1/lifecycle/unsubscribe?token=t"'
    );
  });

  test("the done and invalid states render their own heading", () => {
    const base = {
      actionUrl: "https://api.example.com/u",
      appUrl: "https://app.example.com",
    };

    expect(unsubscribePage({ ...base, state: "done" })).toContain(
      "You're unsubscribed"
    );
    expect(unsubscribePage({ ...base, state: "invalid" })).toContain(
      "That link didn"
    );
  });

  test("escapes the action URL so it cannot break out of the attribute", () => {
    const html = unsubscribePage({
      state: "confirm",
      actionUrl: 'https://x.example.com/"><script>',
      appUrl: "https://app.example.com",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });
});
