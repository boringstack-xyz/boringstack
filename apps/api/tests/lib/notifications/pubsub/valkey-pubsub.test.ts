import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
  userNotificationChannel,
  valkeyPubSub,
} from "../../../../src/lib/notifications";
import { requireValkey } from "../../../helpers/valkey";

const waitFor = (
  predicate: () => boolean,
  timeoutMs: number
): Promise<boolean> => {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve(true);

        return;
      }

      if (Date.now() - start < timeoutMs) {
        return;
      }

      clearInterval(interval);
      resolve(false);
    }, 20);
  });
};

describe("Valkey pub/sub primitives", () => {
  afterEach(async () => {
    await valkeyPubSub.resetForTests();
  });

  afterAll(async () => {
    await valkeyPubSub.resetForTests();
  });

  test("valkeyPubSub.publish + valkeyPubSub.subscribe round-trips a message", async () => {
    if (!(await requireValkey())) {
      return;
    }

    const channel = `test:pubsub:roundtrip:${Date.now().toString()}`;
    const received: string[] = [];
    const subscriber = await valkeyPubSub.subscribe(channel, (msg) => {
      received.push(msg);
    });

    try {
      await valkeyPubSub.publish(channel, "hello");
      await valkeyPubSub.publish(channel, "world");

      const arrived = await waitFor(() => received.length >= 2, 500);

      expect(arrived).toBe(true);
      expect(received).toEqual(["hello", "world"]);
    } finally {
      await subscriber.disconnect();
    }
  });

  test("valkeyPubSub.subscribe does not receive messages from other channels", async () => {
    if (!(await requireValkey())) {
      return;
    }

    const ourChannel = `test:pubsub:isolated:${Date.now().toString()}`;
    const otherChannel = `test:pubsub:other:${Date.now().toString()}`;
    const received: string[] = [];
    const subscriber = await valkeyPubSub.subscribe(ourChannel, (msg) => {
      received.push(msg);
    });

    try {
      await valkeyPubSub.publish(otherChannel, "noise");
      await valkeyPubSub.publish(ourChannel, "signal");

      const arrived = await waitFor(() => received.length >= 1, 500);

      expect(arrived).toBe(true);
      expect(received).toEqual(["signal"]);
    } finally {
      await subscriber.disconnect();
    }
  });
});

describe("userNotificationChannel", () => {
  test("returns the canonical channel name for a user id", () => {
    expect(userNotificationChannel("abc-123")).toBe(
      "notifications:user:abc-123"
    );
  });
});
