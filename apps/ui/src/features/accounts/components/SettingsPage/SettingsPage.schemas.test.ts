import { describe, expect, it } from "vitest";

import { renameAccountSchema } from "./SettingsPage.schemas";

describe("renameAccountSchema", () => {
  it("accepts a non-empty account name", () => {
    const result = renameAccountSchema.safeParse({ name: "Acme Corp" });

    expect(result.success).toBe(true);
  });

  it("rejects an empty account name", () => {
    const result = renameAccountSchema.safeParse({ name: "" });

    expect(result.success).toBe(false);
  });
});
