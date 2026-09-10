/**
 * F16 — push registration accepts arbitrary destinations.
 *
 * `notifications.push.schemas.ts:9` validates the destination as
 * `t.String({ minLength: 1, maxLength: 2048 })`. No URL format, no scheme
 * check, no origin allowlist. Any string is stored, and the web-push SDK later
 * builds a request to it with no explicit timeout
 * (`queues/web-push-delivery/web-push-delivery.worker.ts`).
 *
 * The realistic primitive is an outbound HTTPS POST to an attacker-chosen
 * host, which is why this is Medium standalone and High only if delivery is
 * enabled for untrusted registrations.
 *
 * Where this asserts, and why
 * ---------------------------
 * At the service boundary, not the TypeBox schema. Validating a destination
 * usually wants DNS resolution and an egress policy, which is asynchronous and
 * therefore cannot live in a synchronous schema. Asserting on the schema would
 * leave a correct service-level validator failing this suite — the test would
 * be dictating where the check lives rather than that it exists.
 *
 * NO OUTBOUND REQUEST IS MADE. The point is that the destination is refused
 * before it is ever stored; proving it would be blocked at send time would
 * mean building the request, which is the thing that must not happen.
 *
 * Not covered here: delivery-time behaviour — DNS rebinding between
 * validation and send, and the missing request deadline. Those need tests at
 * the worker boundary.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { notificationsPushService } from "../src/api/notifications/notifications.push.service";
import { cleanDatabase } from "../tests/helpers/db";
import { seedVerifiedUser } from "../tests/helpers/auth";
import { requireDbOrFail } from "./harness";

const OWNER = "f16-owner@gmail.com";

/*
 * Destinations that must never be stored. Loopback and link-local are the
 * classic SSRF targets; the IPv6 forms matter because an allowlist written
 * against IPv4 text alone misses them.
 */
const REJECTED = [
  ["loopback v4", "https://127.0.0.1/push"],
  ["loopback name", "https://localhost/push"],
  ["loopback v6", "https://[::1]/push"],
  ["private 10/8", "https://10.0.0.5/push"],
  ["private 172.16/12", "https://172.16.0.5/push"],
  ["private 192.168/16", "https://192.168.1.5/push"],
  ["link-local v4", "https://169.254.169.254/latest/meta-data/"],
  ["link-local v6", "https://[fe80::1]/push"],
  ["unique local v6", "https://[fc00::1]/push"],
  ["plaintext scheme", "http://push.example.com/x"],
  ["non-http scheme", "file:///etc/passwd"],
  ["not a url at all", "just-a-string"],
] as const;

let userId = "";

const register = async (endpoint: string): Promise<"stored" | "refused"> =>
  notificationsPushService
    .subscribe({
      userId,
      endpoint,
      p256dhKey: "B".repeat(87),
      authKey: "C".repeat(22),
      expiresAt: null,
      userAgent: null,
    })
    .then(() => "stored" as const)
    .catch(() => "refused" as const);

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();

  const { user } = await seedVerifiedUser({ email: OWNER });

  userId = user.id;
});

describe("F16 push endpoint destinations", () => {
  for (const [label, endpoint] of REJECTED) {
    test(`rejects ${label}`, async () => {
      expect(await register(endpoint)).toBe("refused");
    });
  }

  test("control: a real push service origin is accepted", async () => {
    /*
     * Proves registration works at all, so the refusals above are about the
     * destination rather than a broken fixture. It must stay green.
     */
    expect(await register("https://fcm.googleapis.com/fcm/send/abc123")).toBe(
      "stored"
    );
  });
});
