import type { BrowserContext } from "@playwright/test";

import { robotConfig } from "../robot.config";
import { recordCall } from "./journeys";

/*
 * Production limits requests per address: 100 a minute to the API at the
 * edge (infra/k3s/overlays/prod/middlewares.yaml) and 10 a minute to the
 * sign-in routes in the API (AUTH_RATE_LIMIT_MAX). A person never comes
 * near either; a robot opening forty pages a minute passes both. So the
 * robot waits its turn, under both limits with room to spare, instead of
 * being let past them: it should meet the same doors a visitor does.
 */
const WINDOW_MS = 60_000;
/* A journey starts only once this share of each budget is free, so it rarely has to wait halfway through a page. */
const ROOM_TO_START = 0.7;
const SIGN_IN_PREFIX = "/api/v1/auth/";

class Budget {
  private readonly stamps: number[] = [];
  private total = 0;

  public constructor(private readonly perMinute: number) {}

  public get used(): number {
    return this.total;
  }

  /** Resolves when at least `room` more requests fit in the last minute. */
  public async settle(room: number): Promise<void> {
    for (;;) {
      const now = Date.now();
      const live = this.stamps.filter((stamp) => stamp > now - WINDOW_MS);
      const excess = live.length - (this.perMinute - room);
      const blocker = live[excess - 1];

      if (excess <= 0 || blocker === undefined) {
        return;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, blocker + WINDOW_MS - now + 25);
      });
    }
  }

  /** Resolves when one more request fits in the last minute. */
  public async take(): Promise<void> {
    for (;;) {
      const now = Date.now();

      while ((this.stamps[0] ?? now) <= now - WINDOW_MS) {
        this.stamps.shift();
      }

      const oldest = this.stamps[0];

      if (oldest === undefined || this.stamps.length < this.perMinute) {
        this.stamps.push(now);
        this.total += 1;

        return;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, oldest + WINDOW_MS - now + 25);
      });
    }
  }
}

/* One address, one budget: shared by every page and API call in the run. */
const api = new Budget(robotConfig.apiPerMinute);
const signIn = new Budget(robotConfig.signInPerMinute);
const appOrigin = new URL(robotConfig.appURL).origin;

/** Waits for a turn before a request to the app's API, and records it against the running journey. */
export async function takeTurn(
  method: string,
  pathname: string
): Promise<void> {
  recordCall(method, pathname);

  if (pathname.startsWith(SIGN_IN_PREFIX)) {
    await signIn.take();
  }

  await api.take();
}

/** Waits until a whole journey fits under the limits. Called before each one. */
export async function waitForRoom(): Promise<void> {
  await api.settle(Math.floor(robotConfig.apiPerMinute * ROOM_TO_START));
  await signIn.settle(Math.floor(robotConfig.signInPerMinute * ROOM_TO_START));
}

/** Paces every API request a browser context makes to the app. */
export async function paceContext(context: BrowserContext): Promise<void> {
  await context.route(
    (url) => url.origin === appOrigin && url.pathname.startsWith("/api/"),
    async (route) => {
      await takeTurn(
        route.request().method(),
        new URL(route.request().url()).pathname
      );
      await route.fallback();
    }
  );
}

/** How many requests the run has made so far: printed at the end of a run. */
export function requestsMade(): { api: number; signIn: number } {
  return { api: api.used, signIn: signIn.used };
}
