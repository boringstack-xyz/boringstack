import { describe, expect, it } from "vitest";

import { envSchema } from "./schema";

describe("envSchema", () => {
  it("applies sensible defaults when nothing is provided", () => {
    const result = envSchema.safeParse({});

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.VITE_APP_NAME).toBe("BoringStack");
    expect(result.data.VITE_API_URL).toBe("");
    expect(result.data.VITE_LOCALES).toEqual(["en"]);
  });

  it("rejects a malformed URL", () => {
    const result = envSchema.safeParse({ VITE_API_URL: "not a url" });

    expect(result.success).toBe(false);
  });

  it("accepts an empty VITE_API_URL (same-origin sentinel)", () => {
    const result = envSchema.safeParse({ VITE_API_URL: "" });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.VITE_API_URL).toBe("");
    }
  });

  it("splits VITE_LOCALES on comma and trims whitespace", () => {
    const result = envSchema.safeParse({ VITE_LOCALES: "en, fr, de" });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.VITE_LOCALES).toEqual(["en", "fr", "de"]);
    }
  });
});
