import { type Page, test as base, expect, request } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { robotConfig } from "../robot.config";
import { endJourney, startJourney } from "./journeys";
import { paceContext, takeTurn, waitForRoom } from "./pace";

/** The reserved domain the API treats as the robot's (apps/api/src/lib/synthetic). */
export const ROBOT_EMAIL_DOMAIN = "robot.boringstack.invalid";

const SECRET_HEADER = "x-synthetic-secret";

export interface IRobotUser {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

/** A new robot user for this run. Its address can receive no mail. */
export function newRobotUser(): IRobotUser {
  return {
    email: `run-${randomUUID()}@${ROBOT_EMAIL_DOMAIN}`,
    // gitleaks:allow: generated per run for an account the run deletes
    password: `Robot-${randomUUID()}-A1`,
    firstName: "Verification",
    lastName: "Robot"
  };
}

async function robotCall(
  path: "verify" | "upgrade" | "cleanup",
  email: string
): Promise<number> {
  const ctx = await request.newContext({ baseURL: robotConfig.appURL });

  try {
    await takeTurn("POST", `/api/v1/auth/synthetic/${path}`);

    const res = await ctx.post(`/api/v1/auth/synthetic/${path}`, {
      headers: { [SECRET_HEADER]: robotConfig.secret ?? "" },
      data: { email }
    });

    return res.status();
  } finally {
    await ctx.dispose();
  }
}

/** Stands in for clicking the emailed link: the one step a robot cannot do. */
export async function verifyRobotEmail(user: IRobotUser): Promise<void> {
  expect(
    await robotCall("verify", user.email),
    "the robot-only verify route accepts the secret"
  ).toBe(200);
}

/** Puts the robot's own account on Pro without payment, to walk what a paying member uses. */
export async function upgradeRobot(user: IRobotUser): Promise<void> {
  expect(
    await robotCall("upgrade", user.email),
    "the robot-only upgrade route accepts the secret"
  ).toBe(200);
}

/** Removes the robot's user and everything it made. */
export async function removeRobotUser(user: IRobotUser): Promise<void> {
  expect(
    await robotCall("cleanup", user.email),
    "the robot-only cleanup route accepts the secret"
  ).toBe(200);
}

/**
 * Everything that went wrong on a page without failing a visible assertion:
 * script errors and server errors. A journey that looks fine while the page
 * throws or the API answers 500 is still a broken product.
 */
export interface IPageHealth {
  readonly problems: string[];
}

export function watchHealth(page: Page): IPageHealth {
  const problems: string[] = [];

  page.on("pageerror", (error) => {
    problems.push(`script error on ${page.url()}: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      problems.push(
        `${String(response.status())} from ${response.request().method()} ${response.url()}`
      );
    }
  });

  return { problems };
}

/** Fails the journey on anything the health watch caught, then starts clean. */
export function expectHealthy(health: IPageHealth): void {
  const seen = [...health.problems];

  health.problems.length = 0;
  expect(seen, "no script errors and no server errors").toEqual([]);
}

/**
 * The cookie banner would cover what the robot clicks; it declines it like a
 * person would. Add a handler here for any prompt your product shows on top
 * of a page.
 */
export async function dismissInterruptions(page: Page): Promise<void> {
  await page.addLocatorHandler(
    page.getByRole("region", { name: /cookie consent/iu }),
    async (banner) => {
      await banner
        .getByRole("button", { name: /reject non-essential/iu })
        .click();
    }
  );
  /* The one-question feedback card never blocks a journey: it is closed like a person would. */
  await page.addLocatorHandler(
    page.getByRole("region", { name: /quick question/iu }),
    async (card) => {
      await card.getByRole("button", { name: /not now/iu }).click();
    }
  );
}

/**
 * Opens a page and waits until it has settled: the lazy route has loaded and
 * its first requests have answered, so what the robot types is not wiped by a
 * late render.
 */
export async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Every robot page waits its turn at the API (see ./pace). */
export const test = base.extend<{ room: undefined }>({
  context: async ({ context }, use) => {
    await paceContext(context);
    await use(context);
  },
  /* Each journey starts once it fits under the limits; the time limit in playwright.robot.config.ts allows for the wait. */
  room: [
    async ({}, use, testInfo) => {
      startJourney(testInfo.title);
      await waitForRoom();
      await use(undefined);
      endJourney(
        testInfo.title,
        testInfo.status === "passed" && testInfo.expectedStatus === "passed"
      );
    },
    { auto: true }
  ]
});

export { expect } from "@playwright/test";
