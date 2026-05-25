import type { OAuthProvider } from "../../lib/oauth";
import type { Env } from "../../config/env";

export type ICapabilityEnv = Pick<
  Env,
  | "AI_ENABLED"
  | "BILLING_ENABLED"
  | "NOTIFICATIONS_SSE_ENABLED"
  | "WEB_PUSH_VAPID_PUBLIC"
  | "WEB_PUSH_VAPID_PRIVATE"
  | "WEB_PUSH_VAPID_SUBJECT"
  | "GOOGLE_OAUTH_CLIENT_ID"
  | "GOOGLE_OAUTH_CLIENT_SECRET"
  | "GITHUB_OAUTH_CLIENT_ID"
  | "GITHUB_OAUTH_CLIENT_SECRET"
  | "LINKEDIN_OAUTH_CLIENT_ID"
  | "LINKEDIN_OAUTH_CLIENT_SECRET"
>;

export interface ICapabilities {
  readonly features: {
    readonly notifications: {
      readonly sse: boolean;
      readonly webPush: boolean;
    };
    readonly billing: {
      readonly enabled: boolean;
    };
    readonly ai: {
      readonly enabled: boolean;
    };
  };
  readonly oauth: {
    readonly providers: OAuthProvider[];
  };
}
