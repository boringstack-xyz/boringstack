/*
 * Pure parts of `factory browse` and `factory walk`: which routes the app has
 * (from the robot's coverage list), how a route becomes a URL and a
 * screenshot name, what counts as a failure, and the report that is written.
 */
import type { IFactoryContext } from "../context";
import { portsOf } from "../fleet/fleet.utils";

/** A route the browse pass cannot open, and why. */
export interface ISkippedRoute {
  readonly route: string;
  readonly reason: string;
}

export interface IRouteCatalog {
  readonly open: readonly string[];
  readonly skipped: readonly ISkippedRoute[];
}

/**
 * Every route in the robot's coverage list, in order. The catch-all and any
 * route with a parameter cannot be filled with a real address, so they are
 * listed as skipped rather than guessed at.
 */
export const catalogOf = (routes: Iterable<string>): IRouteCatalog => {
  const open: string[] = [];
  const skipped: ISkippedRoute[] = [];

  for (const route of routes) {
    if (route === "*") {
      skipped.push({ route, reason: "catch-all, not a page" });
    } else if (/[:*]/u.test(route)) {
      skipped.push({ route, reason: "needs a parameter this run cannot fill" });
    } else {
      open.push(route);
    }
  }

  return { open, skipped };
};

/** The address of a route on a stack: the base address plus the route, query-free. */
export const pageUrlOf = (baseUrl: string, route: string): string =>
  new URL(route, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();

/** `/account/billing` → `account-billing`; `/` → `home`. */
export const screenshotNameOf = (route: string): string => {
  const name = route
    .replace(/^\/+|\/+$/gu, "")
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();

  return name === "" ? "home" : name;
};

/** A run id from an ISO time: `2026-11-23T10:15:00.000Z` → `20261123-101500`. */
export const runIdOf = (iso: string): string =>
  iso.slice(0, 19).replace(/[-:]/gu, "").replace("T", "-");

/** A 5xx answer from the app, or from the API behind it. */
export const isServerError = (status: number): boolean => status >= 500;

/** Whether a URL is one of the app's API calls (`/api/…` on the stack's address). */
export const isApiCall = (url: string): boolean => {
  try {
    return new URL(url).pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

/** The URL without its query, which can hold a sign-in token. */
export const redactedUrl = (url: string): string => {
  try {
    const parsed = new URL(url);

    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "(unreadable URL)";
  }
};

export interface IRouteResult {
  readonly route: string;
  readonly url: string;
  readonly ok: boolean;
  /** Each problem in plain words; empty when the route passed. */
  readonly problems: readonly string[];
  /** The screenshot file, or null when the page could not be shown. */
  readonly screenshot: string | null;
}

export interface IBrowseReport {
  readonly runId: string;
  readonly baseUrl: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly signedIn: boolean;
  readonly ok: boolean;
  readonly routes: readonly IRouteResult[];
  readonly skipped: readonly ISkippedRoute[];
}

export const buildReport = (input: {
  readonly runId: string;
  readonly baseUrl: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly signedIn: boolean;
  readonly routes: readonly IRouteResult[];
  readonly skipped: readonly ISkippedRoute[];
}): IBrowseReport => ({
  ...input,
  ok: input.signedIn && input.routes.every((route) => route.ok),
});

/** One line per route, then the verdict, for the person reading the terminal. */
export const summaryLines = (report: IBrowseReport): string[] => {
  const failed = report.routes.filter((route) => !route.ok);
  const shots = report.routes.filter(
    (route) => route.screenshot !== null
  ).length;

  return [
    ...report.routes.map((route) =>
      route.ok
        ? `  ok    ${route.route}`
        : `  FAIL  ${route.route}: ${route.problems.join("; ")}`
    ),
    ...report.skipped.map((skip) => `  skip  ${skip.route}: ${skip.reason}`),
    `${String(report.routes.length - failed.length)} of ${String(report.routes.length)} route(s) passed, ${String(shots)} screenshot(s) in .agent-state/factory/browse/${report.runId}/`,
  ];
};

/**
 * The address a stack's app answers on: `--base-url` when given, else the
 * workspace's own slot (README "Slots": ui port base + N). Null when neither.
 */
export const baseUrlFor = (
  context: IFactoryContext,
  explicit: string | null,
  slot: number | null
): string | null => {
  if (explicit !== null) {
    return explicit;
  }

  return slot === null
    ? null
    : `http://127.0.0.1:${String(portsOf(slot, context.config.portBases).ui)}`;
};
