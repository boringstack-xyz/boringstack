import { describe, expect, it } from "vitest";

import { edgeStateIconFor } from "./EdgeState.utils";

describe("edgeStateIconFor", () => {
  it("gives a failure the danger tone and a finished state the outline tone", () => {
    expect(edgeStateIconFor("offline").tone).toBe("danger");
    expect(edgeStateIconFor("success").tone).toBe("outline");
  });

  it("gives every kind an icon", () => {
    for (const kind of [
      "missing",
      "error",
      "empty",
      "offline",
      "loading",
      "success"
    ] as const) {
      expect(edgeStateIconFor(kind).icon).toBeDefined();
    }
  });
});
