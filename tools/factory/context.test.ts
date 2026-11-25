import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./context";

describe("repoRoot", () => {
  /*
   * A slot claim records the workspace path without one; a trailing slash
   * made browse, walk and logs miss the workspace's own running stack.
   */
  test("has no trailing slash, so it equals the path a slot claim records", () => {
    expect(repoRoot().endsWith("/")).toBe(false);
    expect(existsSync(join(repoRoot(), "package.json"))).toBe(true);
  });
});
