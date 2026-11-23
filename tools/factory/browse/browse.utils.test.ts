import { describe, expect, test } from "bun:test";

import { ROBOT_COVERAGE } from "../../../apps/ui/e2e/robot/coverage";
import { FACTORY_CONFIG } from "../factory.config";
import { contextAt, tempDir } from "../fleet/fleet.test-helpers";
import {
  baseUrlFor,
  buildReport,
  catalogOf,
  isApiCall,
  pageUrlOf,
  redactedUrl,
  runIdOf,
  screenshotNameOf,
  summaryLines,
} from "./browse.utils";

describe("browse routes", () => {
  test("every robot-covered route is opened, except the catch-all", () => {
    const catalog = catalogOf(Object.keys(ROBOT_COVERAGE));

    expect(catalog.open).toContain("/dashboard");
    expect(catalog.open).toContain("/");
    expect(catalog.open).not.toContain("*");
    expect(catalog.skipped).toEqual([
      { route: "*", reason: "catch-all, not a page" },
    ]);
  });

  test("a route with a parameter is skipped and named", () => {
    expect(catalogOf(["/items/:id", "/home"])).toEqual({
      open: ["/home"],
      skipped: [
        {
          route: "/items/:id",
          reason: "needs a parameter this run cannot fill",
        },
      ],
    });
  });

  test("a route becomes an address on the stack", () => {
    expect(pageUrlOf("http://127.0.0.1:7401", "/dashboard")).toBe(
      "http://127.0.0.1:7401/dashboard"
    );
    expect(pageUrlOf("http://127.0.0.1:7401/", "/")).toBe(
      "http://127.0.0.1:7401/"
    );
  });

  test("screenshot names keep routes apart", () => {
    expect(screenshotNameOf("/account/audit-log")).toBe("account-audit-log");
    expect(screenshotNameOf("/")).toBe("home");
  });
});

describe("browse failures and reports", () => {
  test("run ids come from the start time", () => {
    expect(runIdOf("2026-11-23T10:15:00.123Z")).toBe("20261123-101500");
  });

  test("API calls are recognised by path, and URLs lose their query", () => {
    expect(
      isApiCall("http://127.0.0.1:7401/api/v1/accounts?token=secret")
    ).toBe(true);
    expect(isApiCall("http://127.0.0.1:7401/dashboard")).toBe(false);
    expect(redactedUrl("http://127.0.0.1:7401/api/v1/x?token=secret")).toBe(
      "http://127.0.0.1:7401/api/v1/x"
    );
  });

  test("a route with no problems passes; a failed run says which routes failed", () => {
    const report = buildReport({
      runId: "20261123-101500",
      baseUrl: "http://127.0.0.1:7401",
      startedAt: "a",
      finishedAt: "b",
      signedIn: true,
      skipped: [{ route: "*", reason: "catch-all, not a page" }],
      routes: [
        {
          route: "/",
          url: "u",
          ok: true,
          problems: [],
          screenshot: "home.png",
        },
        {
          route: "/billing",
          url: "u",
          ok: false,
          problems: ["500 from GET /api/v1/billing"],
          screenshot: "billing.png",
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(summaryLines(report)).toEqual([
      "  ok    /",
      "  FAIL  /billing: 500 from GET /api/v1/billing",
      "  skip  *: catch-all, not a page",
      "1 of 2 route(s) passed, 2 screenshot(s) in .agent-state/factory/browse/20261123-101500/",
    ]);
  });

  test("a run that could not sign in is not ok, whatever the routes say", () => {
    expect(
      buildReport({
        runId: "r",
        baseUrl: "b",
        startedAt: "a",
        finishedAt: "b",
        signedIn: false,
        routes: [],
        skipped: [],
      }).ok
    ).toBe(false);
  });
});

describe("base address", () => {
  test("--base-url wins, then the workspace's slot, else nothing", () => {
    const context = contextAt(
      tempDir("browse-base"),
      tempDir("browse-base-shared")
    );

    expect(baseUrlFor(context, "https://dev.example", 2)).toBe(
      "https://dev.example"
    );
    expect(baseUrlFor(context, null, 2)).toBe(
      `http://127.0.0.1:${String(FACTORY_CONFIG.portBases.ui + 2)}`
    );
    expect(baseUrlFor(context, null, null)).toBeNull();
  });
});
