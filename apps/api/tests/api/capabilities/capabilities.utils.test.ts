import { describe, expect, test } from "bun:test";

import {
  buildCapabilities,
  isWebPushConfigured,
} from "../../../src/api/capabilities/capabilities.utils";
import type { ICapabilityEnv } from "../../../src/api/capabilities/capabilities.types";

const baseSource: ICapabilityEnv = {
  AI_ENABLED: false,
  BILLING_ENABLED: false,
  NOTIFICATIONS_SSE_ENABLED: false,
  WEB_PUSH_VAPID_PUBLIC: "",
  WEB_PUSH_VAPID_PRIVATE: "",
  WEB_PUSH_VAPID_SUBJECT: "",
  GOOGLE_OAUTH_CLIENT_ID: "",
  GOOGLE_OAUTH_CLIENT_SECRET: "",
  GITHUB_OAUTH_CLIENT_ID: "",
  GITHUB_OAUTH_CLIENT_SECRET: "",
  LINKEDIN_OAUTH_CLIENT_ID: "",
  LINKEDIN_OAUTH_CLIENT_SECRET: "",
};

describe("isWebPushConfigured", () => {
  test("requires the full VAPID key set", () => {
    expect(isWebPushConfigured(baseSource)).toBe(false);
    expect(
      isWebPushConfigured({
        ...baseSource,
        WEB_PUSH_VAPID_PUBLIC: "public",
        WEB_PUSH_VAPID_PRIVATE: "private",
        WEB_PUSH_VAPID_SUBJECT: "mailto:test@example.com",
      })
    ).toBe(true);
  });
});

describe("buildCapabilities", () => {
  test("filters OAuth providers unless both id and secret are configured", () => {
    const capabilities = buildCapabilities({
      ...baseSource,
      AI_ENABLED: true,
      BILLING_ENABLED: true,
      NOTIFICATIONS_SSE_ENABLED: true,
      WEB_PUSH_VAPID_PUBLIC: "public",
      WEB_PUSH_VAPID_PRIVATE: "private",
      WEB_PUSH_VAPID_SUBJECT: "mailto:test@example.com",
      GOOGLE_OAUTH_CLIENT_ID: "google-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
      GITHUB_OAUTH_CLIENT_ID: "github-id",
      GITHUB_OAUTH_CLIENT_SECRET: "",
      LINKEDIN_OAUTH_CLIENT_ID: "linkedin-id",
      LINKEDIN_OAUTH_CLIENT_SECRET: "linkedin-secret",
    });

    expect(capabilities.features.notifications).toEqual({
      sse: true,
      webPush: true,
    });
    expect(capabilities.features.billing.enabled).toBe(true);
    expect(capabilities.features.ai.enabled).toBe(true);
    expect(capabilities.oauth.providers).toEqual(["google", "linkedin"]);
  });
});
