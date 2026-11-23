import { describe, expect, test } from "bun:test";

import { contextAt, tempDir } from "../fleet/fleet.test-helpers";
import { browseRun, type IBrowseDeps } from "./browse";
import type { IVisitInput, IVisitOutcome } from "./browse.playwright";
import type { IRouteResult } from "./browse.utils";

const ok: IRouteResult = {
  route: "/",
  url: "u",
  ok: true,
  problems: [],
  screenshot: "home.png",
};

/** Deps that never reach a browser or a stack: each test says what the visit returns. */
const deps = (
  outcome: IVisitOutcome,
  reachable = true
): IBrowseDeps & { visited: IVisitInput[] } => {
  const visited: IVisitInput[] = [];

  return {
    visited,
    now: () => "2026-11-23T10:15:00.000Z",
    newUser: () => ({
      email: "e@x.invalid",
      password: "p",
      firstName: "f",
      lastName: "l",
    }),
    isReachable: () => Promise.resolve(reachable),
    visit: (input) => {
      visited.push(input);

      return Promise.resolve(outcome);
    },
  };
};

const BASE_FLAG = "--base-url";
const BASE = "http://127.0.0.1:7401";

describe("factory browse", () => {
  test("a workspace with no stack and no --base-url is blocked", async () => {
    const outcome = await browseRun(
      [],
      contextAt(tempDir("browse-x"), tempDir("browse-xs")),
      deps({ signInError: null, routes: [] })
    );

    expect(outcome.code).toBe(2);
  });

  test("a bad --base-url is a failure naming the flag", async () => {
    const outcome = await browseRun(
      [BASE_FLAG, "localhost:7401"],
      contextAt(tempDir("browse-y"), tempDir("browse-ys")),
      deps({ signInError: null, routes: [] })
    );

    expect(outcome.code).toBe(1);
    expect(outcome.summary).toContain(BASE_FLAG);
  });

  test("a stack that is not answering is blocked before anything is opened", async () => {
    const fake = deps({ signInError: null, routes: [] }, false);
    const outcome = await browseRun(
      [BASE_FLAG, BASE],
      contextAt(tempDir("browse-z"), tempDir("browse-zs")),
      fake
    );

    expect(outcome.code).toBe(2);
    expect(fake.visited).toEqual([]);
  });

  test("a sign-in that fails is blocked, and the report says so", async () => {
    const root = tempDir("browse-signin");
    const fake = deps({ signInError: "register answered 500", routes: [] });
    const outcome = await browseRun(
      [BASE_FLAG, BASE],
      contextAt(root, tempDir("browse-signin-s")),
      fake
    );

    expect(outcome.code).toBe(2);
    expect(outcome.summary).toContain("register answered 500");
    expect(fake.visited[0]?.routes.length).toBeGreaterThan(0);
  });

  test("every route passing is ok; a failing route fails the run and keeps its report", async () => {
    const root = tempDir("browse-pass");
    const passing = await browseRun(
      [BASE_FLAG, BASE],
      contextAt(root, tempDir("browse-pass-s")),
      deps({ signInError: null, routes: [ok] })
    );

    expect(passing.code).toBe(0);
    expect(passing.summary).toContain("1 of 1 route(s) passed");

    const failing = await browseRun(
      [BASE_FLAG, BASE],
      contextAt(root, tempDir("browse-fail-s")),
      deps({
        signInError: null,
        routes: [{ ...ok, ok: false, problems: ["console error: x"] }],
      })
    );

    expect(failing.code).toBe(1);
    expect(failing.summary).toContain("FAIL  /: console error: x");
  });
});
