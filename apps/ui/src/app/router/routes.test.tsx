import type * as ReactRouterDom from "react-router-dom";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { ROBOT_API_COVERAGE } from "../../../e2e/robot/api-coverage";
import { ROBOT_COVERAGE } from "../../../e2e/robot/coverage";
import "./routes";

/*
 * The app builds its router when routes.tsx loads. The spy records the real
 * route table handed to createBrowserRouter, so this test reads the table
 * the app uses rather than a copy.
 */
const captured = vi.hoisted(() => ({
  routes: [] as ReactRouterDom.RouteObject[]
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDom>();

  return {
    ...actual,
    createBrowserRouter: (routes: ReactRouterDom.RouteObject[]) => {
      captured.routes = routes;

      return actual.createMemoryRouter(routes);
    }
  };
});

const ROBOT_DIR = join(__dirname, "..", "..", "..", "e2e", "robot");
const SCHEMA = join(__dirname, "..", "..", "lib", "api", "schema.d.ts");

/** Every journey title the robot has, as the specs spell them. */
const robotSpecs = (): string =>
  readdirSync(ROBOT_DIR)
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => readFileSync(join(ROBOT_DIR, name), "utf8"))
    .join("\n");

/** `METHOD /path` for every operation in the generated OpenAPI types. */
const apiOperations = (): string[] => {
  const source = readFileSync(SCHEMA, "utf8");
  const paths = source.slice(
    source.indexOf("export interface paths {"),
    source.indexOf("export type webhooks")
  );

  return [...paths.matchAll(/^ {4}"([^"]+)": \{([\s\S]*?)^ {4}\};/gmu)].flatMap(
    ([, path = "", body = ""]) =>
      [
        ...body.matchAll(
          /^ {8}(get|put|post|delete|patch|options|head|trace): operations/gmu
        )
      ].map(([, method = ""]) => `${method.toUpperCase()} ${path}`)
  );
};

const expectEveryEntryProven = (
  coverage: Readonly<
    Record<string, { journeys?: readonly string[]; notChecked?: string }>
  >,
  specs: string
): void => {
  for (const [key, entry] of Object.entries(coverage)) {
    const journeys = entry.journeys ?? [];

    expect(
      journeys.length > 0 || (entry.notChecked ?? "") !== "",
      `${key} needs a robot journey or a reason`
    ).toBe(true);

    for (const title of journeys) {
      expect(specs, `${key}: no robot journey titled "${title}"`).toContain(
        `test("${title}"`
      );
    }
  }
};

describe("app routes", () => {
  /*
   * The verification robot opens every page in production
   * (docs/operations/production-verification.md). A route added without a
   * robot journey, or a list entry naming a journey the robot does not have,
   * fails here.
   */
  it("has a production robot journey, or a written reason, for every route", () => {
    const paths = captured.routes.map((route) => route.path ?? "").sort();

    expect(Object.keys(ROBOT_COVERAGE).sort()).toEqual(paths);
    expectEveryEntryProven(ROBOT_COVERAGE, robotSpecs());
  });

  /*
   * The same contract for the API: every operation the UI's generated
   * client knows about names the robot journeys that call it, or why none
   * can. check-api-coverage.ts then proves the claim on every robot run.
   */
  it("has a production robot journey, or a written reason, for every API operation", () => {
    const operations = apiOperations();

    expect(operations.length).toBeGreaterThan(0);
    expect(Object.keys(ROBOT_API_COVERAGE).sort()).toEqual(
      [...operations].sort()
    );
    expectEveryEntryProven(ROBOT_API_COVERAGE, robotSpecs());
  });
});
