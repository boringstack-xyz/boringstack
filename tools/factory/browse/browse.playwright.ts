/*
 * The browser part of `factory browse`: a Playwright library run, not a test
 * run. Playwright comes from apps/ui's own install (playwright-core, loaded by
 * path, so tools/ needs no node_modules). The robot's health watch is reused
 * from apps/ui/e2e/robot/fixtures/robot.ts by the same path.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { nowMs } from "../clock";
import { isRecord } from "../state";
import {
  isApiCall,
  pageUrlOf,
  redactedUrl,
  type IRouteResult,
  screenshotNameOf,
} from "./browse.utils";

/** The parts of playwright-core this run uses. Only the shapes, so tools/ needs no types from apps/ui. */
export interface IPlaywright {
  readonly chromium: {
    launch: (options?: { headless?: boolean }) => Promise<IBrowser>;
  };
}

interface IBrowser {
  readonly newContext: () => Promise<IContext>;
  readonly close: () => Promise<void>;
}

interface IContext {
  readonly request: IApiRequest;
  readonly newPage: () => Promise<IPage>;
  readonly close: () => Promise<void>;
}

interface IApiResponse {
  readonly ok: () => boolean;
  readonly status: () => number;
}

interface IApiRequest {
  readonly post: (
    url: string,
    options?: { data?: unknown; timeout?: number }
  ) => Promise<IApiResponse>;
}

interface IRequestLike {
  readonly url: () => string;
  readonly method: () => string;
  readonly resourceType: () => string;
  readonly failure: () => { errorText: string } | null;
}

interface IConsoleMessage {
  readonly type: () => string;
  readonly text: () => string;
}

interface IPage {
  readonly on: (event: string, listener: (value: never) => void) => void;
  readonly goto: (
    url: string,
    options?: { waitUntil?: "load"; timeout?: number }
  ) => Promise<unknown>;
  readonly screenshot: (options: {
    path: string;
    fullPage?: boolean;
  }) => Promise<unknown>;
  readonly close: () => Promise<void>;
}

/** The robot's health watch, as apps/ui/e2e/robot/fixtures/robot.ts exports it. */
interface IRobotFixtures {
  readonly watchHealth: (page: IPage) => { readonly problems: string[] };
}

export interface ICredentials {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

const PAGE_TIMEOUT_MS = 30_000;
const SETTLE_QUIET_MS = 500;
const SETTLE_MAX_MS = 10_000;

const isPlaywright = (value: unknown): value is IPlaywright =>
  isRecord(value) &&
  isRecord(value.chromium) &&
  typeof value.chromium.launch === "function";

const isRobotFixtures = (value: unknown): value is IRobotFixtures =>
  isRecord(value) && typeof value.watchHealth === "function";

/** Loads apps/ui's playwright-core by path. Throws when apps/ui has not been installed. */
export const loadPlaywright = async (uiRoot: string): Promise<IPlaywright> => {
  const loaded: unknown = await import(
    pathToFileURL(join(uiRoot, "node_modules", "playwright-core", "index.mjs"))
      .href
  );

  if (!isPlaywright(loaded)) {
    throw new Error("playwright-core did not load from apps/ui/node_modules");
  }

  return loaded;
};

/** The robot's fixtures, loaded by path so the same health watch runs here. */
export const loadRobotFixtures = async (
  uiRoot: string
): Promise<IRobotFixtures> => {
  const loaded: unknown = await import(
    pathToFileURL(join(uiRoot, "e2e", "robot", "fixtures", "robot.ts")).href
  );

  if (!isRobotFixtures(loaded)) {
    throw new Error("the robot's health watch did not load from apps/ui");
  }

  return loaded;
};

/** Removes query strings from any URL in a message: a query can hold a sign-in token. */
export const redactQueries = (message: string): string =>
  message.replace(/(https?:\/\/[^\s?]+)\?\S*/gu, "$1?<query>");

/** Registers a fresh user and force-verifies it (the dev stack's test endpoint). Returns a reason on failure. */
export const signIn = async (
  context: IContext,
  baseUrl: string,
  user: ICredentials
): Promise<string | null> => {
  const registered = await context.request.post(
    pageUrlOf(baseUrl, "/api/v1/auth/register"),
    { data: user, timeout: PAGE_TIMEOUT_MS }
  );

  if (!registered.ok()) {
    return `register answered ${String(registered.status())}`;
  }

  const verified = await context.request.post(
    pageUrlOf(baseUrl, "/api/v1/auth/__test/force-verify"),
    { data: { email: user.email }, timeout: PAGE_TIMEOUT_MS }
  );

  return verified.ok()
    ? null
    : `force-verify answered ${String(verified.status())} (the stack must run with E2E_TEST_ENDPOINTS_ENABLED=true)`;
};

const isTrackedRequest = (request: IRequestLike): boolean =>
  request.resourceType() !== "eventsource" &&
  request.resourceType() !== "websocket";

/** Waits until no page request has been open for a moment: networkidle never comes on a page with a live stream. */
const settle = async (requests: Set<IRequestLike>): Promise<void> => {
  const deadline = nowMs() + SETTLE_MAX_MS;
  let quietSince = nowMs();

  while (nowMs() < deadline) {
    await Bun.sleep(100);

    if (requests.size > 0) {
      quietSince = nowMs();
    } else if (nowMs() - quietSince >= SETTLE_QUIET_MS) {
      return;
    }
  }
};

/** Opens one route and collects what went wrong on it. */
const visit = async (
  context: IContext,
  robot: IRobotFixtures,
  url: string,
  route: string,
  outDir: string
): Promise<IRouteResult> => {
  const problems: string[] = [];
  const requests = new Set<IRequestLike>();
  const page = await context.newPage();
  const health = robot.watchHealth(page);

  page.on("console", (message: IConsoleMessage) => {
    if (message.type() === "error") {
      problems.push(
        `console error: ${redactQueries(message.text()).slice(0, 300)}`
      );
    }
  });
  page.on("request", (request: IRequestLike) => {
    if (isTrackedRequest(request)) {
      requests.add(request);
    }
  });
  page.on("requestfinished", (request: IRequestLike) =>
    requests.delete(request)
  );
  page.on("requestfailed", (request: IRequestLike) => {
    requests.delete(request);
    const errorText = request.failure()?.errorText ?? "";

    if (isApiCall(request.url()) && !errorText.includes("ERR_ABORTED")) {
      problems.push(
        `failed API call: ${request.method()} ${redactedUrl(request.url())} (${errorText})`
      );
    }
  });

  try {
    await page.goto(url, { waitUntil: "load", timeout: PAGE_TIMEOUT_MS });
    await settle(requests);
  } catch (error: unknown) {
    problems.push(
      `could not open the page (${error instanceof Error ? error.name : "unknown error"})`
    );
  }

  const screenshot = `${screenshotNameOf(route)}.png`;
  let shot: string | null = null;

  try {
    await page.screenshot({ path: join(outDir, screenshot), fullPage: true });
    shot = screenshot;
  } catch {
    problems.push("could not take a screenshot");
  }

  problems.push(...health.problems.map(redactQueries));
  health.problems.length = 0;
  await page.close();

  return {
    route,
    url: redactedUrl(url),
    ok: problems.length === 0,
    problems,
    screenshot: shot,
  };
};

export interface IVisitInput {
  readonly uiRoot: string;
  readonly baseUrl: string;
  readonly routes: readonly string[];
  readonly outDir: string;
  readonly user: ICredentials;
}

export interface IVisitOutcome {
  readonly signInError: string | null;
  readonly routes: IRouteResult[];
}

/** Signs in a fresh verified user, then opens each route in order, screenshotting every one. */
export const visitRoutes = async (
  input: IVisitInput
): Promise<IVisitOutcome> => {
  const playwright = await loadPlaywright(input.uiRoot);
  const robot = await loadRobotFixtures(input.uiRoot);
  const browser = await playwright.chromium.launch({ headless: true });

  mkdirSync(input.outDir, { recursive: true });

  try {
    const context = await browser.newContext();

    try {
      const signInError = await signIn(context, input.baseUrl, input.user);

      if (signInError !== null) {
        return { signInError, routes: [] };
      }

      const routes: IRouteResult[] = [];

      for (const route of input.routes) {
        routes.push(
          await visit(
            context,
            robot,
            pageUrlOf(input.baseUrl, route),
            route,
            input.outDir
          )
        );
      }

      return { signInError: null, routes };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
};
