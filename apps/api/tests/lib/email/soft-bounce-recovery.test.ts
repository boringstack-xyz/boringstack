import { describe, expect, test } from "bun:test";

import type { ICloudflareSuppression } from "../../../src/lib/email/providers/cloudflare-suppressions";
import { recoverSoftBounces } from "../../../src/lib/email/soft-bounce-recovery";
import type { IHandledEmail } from "../../../src/lib/email/soft-bounce-recovery.types";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

const block = (
  email: string,
  overrides: Partial<ICloudflareSuppression> = {}
): ICloudflareSuppression => ({
  id: `id-${email}`,
  email,
  createdAt: new Date(NOW - 2 * MINUTE).toISOString(),
  readOnly: false,
  ...overrides,
});

const setup = (
  blocks: ICloudflareSuppression[],
  handled: IHandledEmail[] = [],
  options: { alreadyClaimed?: string[]; liftFails?: boolean } = {}
) => {
  const lifted: string[] = [];
  const cleared: string[] = [];
  const resent: { subject: string; delayMs: number }[] = [];
  const claimed = new Set(options.alreadyClaimed ?? []);

  const run = () =>
    recoverSoftBounces({
      listSoftBounces: () => Promise.resolve(blocks),
      liftBlock: (id) => {
        if (options.liftFails === true) {
          return Promise.reject(new Error("provider down"));
        }

        lifted.push(id);

        return Promise.resolve();
      },
      claim: (email) => {
        const fresh = !claimed.has(email);

        claimed.add(email);

        return Promise.resolve(fresh);
      },
      clearLocalSuppression: (email) => {
        cleared.push(email);

        return Promise.resolve();
      },
      handledEmails: () => Promise.resolve(handled),
      resend: (data, delayMs) => {
        resent.push({ subject: data.subject, delayMs });

        return Promise.resolve();
      },
      nowMs: () => NOW,
    });

  return { run, lifted, cleared, resent };
};

describe("recoverSoftBounces", () => {
  test("lifts a new block, clears our copy and queues that address's emails again after a pause", async () => {
    const { run, lifted, cleared, resent } = setup(
      [block("sam@example.com")],
      [
        {
          data: {
            to: "sam@example.com",
            subject: "Confirm your email address",
            templatePath: "auth/confirm-your-email",
          },
          finishedAtMs: NOW - 12 * MINUTE,
        },
      ]
    );

    expect(await run()).toEqual({ found: 1, lifted: 1, resent: 1, failed: 0 });
    expect(lifted).toEqual(["id-sam@example.com"]);
    expect(cleared).toEqual(["sam@example.com"]);
    expect(resent).toEqual([
      { subject: "Confirm your email address", delayMs: 5 * MINUTE },
    ]);
  });

  test("leaves alone a block it already lifted today, one Cloudflare manages, and a day-old one", async () => {
    const { run, lifted, resent } = setup(
      [
        block("again@example.com"),
        block("managed@example.com", { readOnly: true }),
        block("old@example.com", {
          createdAt: new Date(NOW - 25 * 60 * MINUTE).toISOString(),
        }),
      ],
      [],
      { alreadyClaimed: ["again@example.com"] }
    );

    expect(await run()).toEqual({ found: 3, lifted: 0, resent: 0, failed: 0 });
    expect(lifted).toEqual([]);
    expect(resent).toEqual([]);
  });

  test("one address failing does not stop the next", async () => {
    const { run, resent } = setup(
      [block("a@example.com"), block("b@example.com")],
      [],
      { liftFails: true }
    );

    expect(await run()).toEqual({
      found: 2,
      lifted: 0,
      resent: 0,
      failed: 2,
    });
    expect(resent).toEqual([]);
  });
});
