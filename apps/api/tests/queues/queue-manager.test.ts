import { describe, expect, test } from "bun:test";
import type { JobsOptions, JobType } from "bullmq";

import type { IEmailDeliveryJobData } from "../../src/queues/email-delivery";
import {
  EMAIL_DELIVERY_DEFAULTS,
  EMAIL_DELIVERY_JOB_NAME,
} from "../../src/queues/email-delivery/email-delivery.constants";
import type { INotificationDispatchJobData } from "../../src/queues/notification-dispatch";
import {
  NOTIFICATION_DISPATCH_DEFAULTS,
  NOTIFICATION_DISPATCH_JOB_NAME,
} from "../../src/queues/notification-dispatch/notification-dispatch.constants";
import { QueueManager } from "../../src/queues/queue-manager";
import type { IWebPushDeliveryJobData } from "../../src/queues/web-push-delivery";
import {
  WEB_PUSH_DELIVERY_DEFAULTS,
  WEB_PUSH_DELIVERY_JOB_NAME,
} from "../../src/queues/web-push-delivery/web-push-delivery.constants";

/*
 * QueueManager only sees the structural surface it declares
 * (IManagedQueue / IEnqueueableQueue / IManagedWorker), so plain stubs
 * exercise the full lifecycle without a Valkey connection — these tests
 * run everywhere, including coverage runs with no local stack.
 */

interface IAddCall {
  jobName: string;
  data: unknown;
  opts: JobsOptions | undefined;
}

interface IQueueStub<TData> {
  readonly name: string;
  add: (jobName: string, data: TData, opts?: JobsOptions) => Promise<unknown>;
  getJobCounts: (...states: JobType[]) => Promise<Record<string, number>>;
  close: () => Promise<void>;
}

const makeQueueStub = <TData>(
  name: string,
  counts: Record<string, number> = {}
): {
  stub: IQueueStub<TData>;
  addCalls: IAddCall[];
  wasClosed: () => boolean;
} => {
  const addCalls: IAddCall[] = [];
  let closed = false;

  return {
    stub: {
      name,
      add: (jobName: string, data: TData, opts?: JobsOptions) => {
        addCalls.push({ jobName, data, opts });

        return Promise.resolve(undefined);
      },
      getJobCounts: () => Promise.resolve(counts),
      close: () => {
        closed = true;

        return Promise.resolve();
      },
    },
    addCalls,
    wasClosed: () => closed,
  };
};

const makeWorkerStub = (): {
  stub: { close: () => Promise<void> };
  wasClosed: () => boolean;
} => {
  let closed = false;

  return {
    stub: {
      close: () => {
        closed = true;

        return Promise.resolve();
      },
    },
    wasClosed: () => closed,
  };
};

const EMAIL_JOB: IEmailDeliveryJobData = {
  to: "user@example.test",
  subject: "Hello",
  templatePath: "welcome",
};

const DISPATCH_JOB: INotificationDispatchJobData = {
  eventType: "account.invited",
  recipientUserId: "user-1",
  payload: { accountId: "acc-1" },
};

const WEB_PUSH_JOB: IWebPushDeliveryJobData = {
  recipientUserId: "user-1",
  notificationDeliveryId: "delivery-1",
  title: "Hi",
  body: "There",
  url: null,
};

const buildFixture = (withWebPush: boolean) => {
  const accountMaintenance = makeQueueStub("account-maintenance");
  const emailDelivery = makeQueueStub<IEmailDeliveryJobData>("email-delivery", {
    waiting: 2,
    failed: 1,
  });
  const notificationDispatch = makeQueueStub<INotificationDispatchJobData>(
    "notification-dispatch"
  );
  const notificationMaintenance = makeQueueStub("notification-maintenance");
  const webPushDelivery =
    makeQueueStub<IWebPushDeliveryJobData>("web-push-delivery");
  const workers = {
    accountMaintenance: makeWorkerStub(),
    emailDelivery: makeWorkerStub(),
    notificationDispatch: makeWorkerStub(),
    notificationMaintenance: makeWorkerStub(),
    webPushDelivery: makeWorkerStub(),
  };

  const manager = new QueueManager({
    accountMaintenanceQueue: accountMaintenance.stub,
    accountMaintenanceWorker: workers.accountMaintenance.stub,
    emailDeliveryQueue: emailDelivery.stub,
    emailDeliveryWorker: workers.emailDelivery.stub,
    notificationDispatchQueue: notificationDispatch.stub,
    notificationDispatchWorker: workers.notificationDispatch.stub,
    notificationMaintenanceQueue: notificationMaintenance.stub,
    notificationMaintenanceWorker: workers.notificationMaintenance.stub,
    webPushDeliveryQueue: withWebPush ? webPushDelivery.stub : null,
    webPushDeliveryWorker: withWebPush ? workers.webPushDelivery.stub : null,
  });

  return {
    manager,
    accountMaintenance,
    emailDelivery,
    notificationDispatch,
    notificationMaintenance,
    webPushDelivery,
    workers,
  };
};

describe("QueueManager.enqueueEmailDelivery", () => {
  test("adds the job with the retry envelope from the queue defaults", async () => {
    const fixture = buildFixture(false);

    await fixture.manager.enqueueEmailDelivery(EMAIL_JOB);

    expect(fixture.emailDelivery.addCalls).toHaveLength(1);

    const call = fixture.emailDelivery.addCalls[0];

    expect(call?.jobName).toBe(EMAIL_DELIVERY_JOB_NAME);
    expect(call?.data).toEqual(EMAIL_JOB);
    expect(call?.opts).toEqual({
      attempts: EMAIL_DELIVERY_DEFAULTS.attempts,
      backoff: {
        type: "exponential",
        delay: EMAIL_DELIVERY_DEFAULTS.backoffDelayMs,
      },
      removeOnComplete: {
        age: EMAIL_DELIVERY_DEFAULTS.removeOnCompleteAge,
        count: EMAIL_DELIVERY_DEFAULTS.removeOnCompleteCount,
      },
      removeOnFail: false,
    });
  });
});

describe("QueueManager.enqueueNotificationDispatch", () => {
  test("adds the job with the retry envelope from the queue defaults", async () => {
    const fixture = buildFixture(false);

    await fixture.manager.enqueueNotificationDispatch(DISPATCH_JOB);

    expect(fixture.notificationDispatch.addCalls).toHaveLength(1);

    const call = fixture.notificationDispatch.addCalls[0];

    expect(call?.jobName).toBe(NOTIFICATION_DISPATCH_JOB_NAME);
    expect(call?.opts?.attempts).toBe(NOTIFICATION_DISPATCH_DEFAULTS.attempts);
  });
});

describe("QueueManager.enqueueWebPushDelivery", () => {
  test("is a logged no-op when web push is not configured", async () => {
    const fixture = buildFixture(false);

    await fixture.manager.enqueueWebPushDelivery(WEB_PUSH_JOB);

    expect(fixture.webPushDelivery.addCalls).toHaveLength(0);
  });

  test("adds the job when the web push queue exists", async () => {
    const fixture = buildFixture(true);

    await fixture.manager.enqueueWebPushDelivery(WEB_PUSH_JOB);

    expect(fixture.webPushDelivery.addCalls).toHaveLength(1);

    const call = fixture.webPushDelivery.addCalls[0];

    expect(call?.jobName).toBe(WEB_PUSH_DELIVERY_JOB_NAME);
    expect(call?.opts?.attempts).toBe(WEB_PUSH_DELIVERY_DEFAULTS.attempts);
  });
});

describe("QueueManager.getStats", () => {
  test("reports the four core queues, defaulting missing counts to 0", async () => {
    const fixture = buildFixture(false);

    const stats = await fixture.manager.getStats();

    expect(stats.map((row) => row.name)).toEqual([
      "account-maintenance",
      "email-delivery",
      "notification-dispatch",
      "notification-maintenance",
    ]);

    const email = stats.find((row) => row.name === "email-delivery");

    expect(email?.counts).toEqual({
      waiting: 2,
      active: 0,
      completed: 0,
      failed: 1,
      delayed: 0,
      paused: 0,
    });
  });

  test("includes web-push-delivery when configured", async () => {
    const fixture = buildFixture(true);

    const stats = await fixture.manager.getStats();

    expect(stats.map((row) => row.name)).toContain("web-push-delivery");
    expect(stats).toHaveLength(5);
  });
});

describe("QueueManager.close", () => {
  test("closes every core queue and worker", async () => {
    const fixture = buildFixture(false);

    await fixture.manager.close();

    expect(fixture.accountMaintenance.wasClosed()).toBe(true);
    expect(fixture.emailDelivery.wasClosed()).toBe(true);
    expect(fixture.notificationDispatch.wasClosed()).toBe(true);
    expect(fixture.notificationMaintenance.wasClosed()).toBe(true);
    expect(fixture.workers.accountMaintenance.wasClosed()).toBe(true);
    expect(fixture.workers.emailDelivery.wasClosed()).toBe(true);
    expect(fixture.workers.notificationDispatch.wasClosed()).toBe(true);
    expect(fixture.workers.notificationMaintenance.wasClosed()).toBe(true);
    // not configured — must not be touched
    expect(fixture.webPushDelivery.wasClosed()).toBe(false);
    expect(fixture.workers.webPushDelivery.wasClosed()).toBe(false);
  });

  test("also closes the web push pair when configured", async () => {
    const fixture = buildFixture(true);

    await fixture.manager.close();

    expect(fixture.webPushDelivery.wasClosed()).toBe(true);
    expect(fixture.workers.webPushDelivery.wasClosed()).toBe(true);
  });
});
