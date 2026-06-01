import { describe, expect, it } from "vitest";

import { useTokens } from "./Tokens.hooks";

describe("useTokens", () => {
  it("returns the canonical token groups", () => {
    const view = useTokens();

    expect(view.groups.length).toBeGreaterThan(0);

    const surfaceGroup = view.groups.find((group) => group.id === "surface");

    expect(surfaceGroup).toBeDefined();
    expect(surfaceGroup?.swatches.some((s) => s.name === "panel")).toBe(true);
  });

  it("exposes a primary group with the strong/low/ink trio", () => {
    const view = useTokens();
    const primary = view.groups.find((group) => group.id === "primary");

    expect(primary).toBeDefined();
    const names = primary?.swatches.map((s) => s.name) ?? [];

    expect(names).toEqual(
      expect.arrayContaining([
        "primary",
        "primary-strong",
        "primary-low",
        "primary-ink"
      ])
    );
  });
});
