/**
 * Delivery-time destination checks.
 *
 * Registration refuses a disallowed endpoint, but rows written before that
 * check existed are still in the table and nothing rewrites them. The worker
 * is the last point before an outbound request, so these seed rows straight
 * into `push_subscription` rather than going through registration: the route
 * would reject exactly the inputs under test, and a fixture that cannot build
 * the state proves nothing about it.
 *
 * Not covered: delivery-time DNS rebinding. The host is re-validated, not the
 * address it resolves to at connect time.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  spyOn,
  test,
} from "bun:test";
import webPush from "web-push";

import { deliverToSubscriptions } from "../../../src/queues/web-push-delivery/web-push-delivery.worker";
import {
  cleanDatabase,
  db,
  eq,
  pushSubscription,
  requireDb,
} from "../../helpers/db";
import { seedVerifiedUser } from "../../helpers/auth";

const VAPID = {
  subject: "mailto:ops@example.com",
  publicKey: "spec-public",
  privateKey: "spec-private",
};

const ALLOWED = "https://fcm.googleapis.com/fcm/send/spec-allowed";
const PRIVATE_ADDRESS = "https://169.254.169.254/latest/meta-data";
const UNAPPROVED_HOST = "https://push.example.com/send/spec";

const seedSubscription = async (
  userId: string,
  endpoint: string
): Promise<string> => {
  const [row] = await db
    .insert(pushSubscription)
    .values({
      userId,
      endpoint,
      p256dhKey: "spec-p256dh",
      authKey: "spec-auth",
    })
    .returning({ id: pushSubscription.id });

  if (row === undefined) {
    throw new Error("failed to seed a push subscription");
  }

  return row.id;
};

const rows = async (
  userId: string
): Promise<{ id: string; endpoint: string }[]> =>
  db
    .select({ id: pushSubscription.id, endpoint: pushSubscription.endpoint })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

type SendSpy = Mock<typeof webPush.sendNotification>;

let sendSpy: SendSpy | null = null;

const stubSender = (): SendSpy => {
  const spy = spyOn(webPush, "sendNotification").mockResolvedValue({
    statusCode: 201,
    body: "",
    headers: {},
  });

  sendSpy = spy;

  return spy;
};

beforeEach(async () => {
  if (!(await requireDb())) {
    return;
  }

  await cleanDatabase();
});

afterEach(() => {
  sendSpy?.mockRestore();
  sendSpy = null;
});

describe("deliverToSubscriptions destination checks", () => {
  test("a private-address endpoint is dropped without calling the sender", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({
      email: "wp-private@example.com",
    });

    await seedSubscription(user.id, PRIVATE_ADDRESS);

    const send = stubSender();
    const result = await deliverToSubscriptions(
      await loadFor(user.id),
      "{}",
      VAPID
    );

    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ attempted: 1, succeeded: 0, pruned: 1 });
    expect(await rows(user.id)).toHaveLength(0);
  });

  test("an unapproved public host is dropped without calling the sender", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({ email: "wp-host@example.com" });

    await seedSubscription(user.id, UNAPPROVED_HOST);

    const send = stubSender();
    const result = await deliverToSubscriptions(
      await loadFor(user.id),
      "{}",
      VAPID
    );

    expect(send).not.toHaveBeenCalled();
    expect(result.pruned).toBe(1);
    expect(await rows(user.id)).toHaveLength(0);
  });

  test("control: an allowed endpoint reaches the sender", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({ email: "wp-ok@example.com" });

    await seedSubscription(user.id, ALLOWED);

    const send = stubSender();
    const result = await deliverToSubscriptions(
      await loadFor(user.id),
      "{}",
      VAPID
    );

    /*
     * Without this the two cases above would also hold for a fan-out that
     * never sends anything, and "the sender was not called" would say
     * nothing about the destination rule.
     */
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ attempted: 1, succeeded: 1, pruned: 0 });
    expect(await rows(user.id)).toHaveLength(1);
  });

  test("a refused subscription does not stop a valid one alongside it", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { user } = await seedVerifiedUser({ email: "wp-mixed@example.com" });

    await seedSubscription(user.id, PRIVATE_ADDRESS);
    await seedSubscription(user.id, ALLOWED);

    const send = stubSender();
    const result = await deliverToSubscriptions(
      await loadFor(user.id),
      "{}",
      VAPID
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ attempted: 2, succeeded: 1, pruned: 1 });

    // The refused row is gone; the deliverable one stays.
    const remaining = await rows(user.id);

    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.endpoint).toBe(ALLOWED);
  });
});

/** The same projection the worker loads, so the test drives the real shape. */
const loadFor = async (
  userId: string
): Promise<
  { id: string; endpoint: string; p256dhKey: string; authKey: string }[]
> =>
  db
    .select({
      id: pushSubscription.id,
      endpoint: pushSubscription.endpoint,
      p256dhKey: pushSubscription.p256dhKey,
      authKey: pushSubscription.authKey,
    })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
