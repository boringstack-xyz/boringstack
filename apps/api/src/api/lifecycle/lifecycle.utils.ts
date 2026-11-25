import { createHmac } from "node:crypto";

import { env } from "../../config/env";
import { constantTimeEqual } from "../../lib/crypto";
import type { IEmailEnvelope } from "../../lib/email/email.types";

import {
  LIFECYCLE_EVENT_PREFIX,
  LIFECYCLE_UNSUBSCRIBE_PURPOSE,
  LIFECYCLE_UTM_MEDIUM,
} from "./lifecycle.constants";
import type { LifecycleStage } from "./lifecycle.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const signature = (userId: string, secret: string): string =>
  createHmac("sha256", secret)
    .update(`${LIFECYCLE_UNSUBSCRIBE_PURPOSE}:${userId}`)
    .digest("hex");

export const lifecycleEventType = (stage: LifecycleStage): string =>
  `${LIFECYCLE_EVENT_PREFIX}${stage}`;

/**
 * Stateless unsubscribe token: the user id plus a keyed signature, so the
 * link works without a login and can't be forged for someone else.
 */
export const signUnsubscribeToken = (userId: string, secret: string): string =>
  `${userId}.${signature(userId, secret)}`;

/** The user id a token was issued for, or null when it doesn't verify. */
export const verifyUnsubscribeToken = (
  token: string,
  secret: string
): string | null => {
  const [userId, given, ...rest] = token.split(".");

  if (userId === undefined || given === undefined || rest.length > 0) {
    return null;
  }

  if (!UUID_PATTERN.test(userId)) {
    return null;
  }

  return constantTimeEqual(given, signature(userId, secret)) ? userId : null;
};

/** Tags a link so the visit shows up as coming from this email. */
export const withEmailUtm = (url: string, stage: LifecycleStage): string => {
  const parsed = new URL(url);

  parsed.searchParams.set("utm_source", "email");
  parsed.searchParams.set("utm_medium", LIFECYCLE_UTM_MEDIUM);
  parsed.searchParams.set("utm_campaign", stage);

  return parsed.toString();
};

/** API root without a trailing slash or `/api` suffix. */
export const apiRoot = (publicApiUrl: string): string => {
  const trimmed = publicApiUrl.replace(/\/+$/, "");

  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
};

export const unsubscribeUrl = (publicApiUrl: string, token: string): string =>
  `${apiRoot(publicApiUrl)}/api/v1/lifecycle/unsubscribe?token=${encodeURIComponent(token)}`;

/*
 * Sender name, reply-to and the List-Unsubscribe headers (RFC 2369 and the
 * RFC 8058 one-click POST) every follow-up email carries.
 */
export const lifecycleEmailEnvelope = (payload: {
  unsubscribeUrl: string;
  replyTo: string;
}): IEmailEnvelope => ({
  fromName: env.APP_NAME,
  ...(payload.replyTo === "" ? {} : { replyTo: payload.replyTo }),
  headers: {
    "List-Unsubscribe": `<${payload.unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
});

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The page behind the email's unsubscribe link. Opening it changes nothing:
 * link scanners prefetch email links, so only the button's POST unsubscribes.
 */
export const unsubscribePage = (input: {
  state: "confirm" | "done" | "invalid";
  actionUrl: string;
  appUrl: string;
}): string => {
  const appName = escapeHtml(env.APP_NAME);
  const body = {
    confirm: `<h1>Stop these emails?</h1>
<p>You'll stop getting follow-up and marketing emails from ${appName}. Account emails such as password resets still come through.</p>
<form method="post" action="${escapeHtml(input.actionUrl)}"><button type="submit">Unsubscribe</button></form>`,
    done: `<h1>You're unsubscribed</h1>
<p>No more follow-up or marketing emails. You can switch follow-up emails back on in your notification settings.</p>`,
    invalid: `<h1>That link didn't work</h1>
<p>It may be incomplete. You can turn these emails off in your notification settings instead.</p>`,
  }[input.state];

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${appName} emails</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#191918;color:#f5f2e9;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:16px}
main{max-width:440px;background:#292925;border:1px solid #43433c;border-radius:8px;padding:32px}
h1{font-size:22px;margin:0 0 12px}p{color:#c2c0b7;margin:0 0 20px}a{color:#e8dfc9}
form{margin:0 0 24px}button{background:#e8dfc9;color:#26231d;border:0;border-radius:6px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer}
</style></head>
<body><main>${body}<p><a href="${escapeHtml(input.appUrl)}">Back to ${appName}</a></p></main></body></html>`;
};
