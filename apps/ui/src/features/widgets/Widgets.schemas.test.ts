import { describe, expect, it } from "vitest";

import { widgetFormSchema } from "./Widgets.schemas";

describe("widgetFormSchema", () => {
  it("trims and accepts a valid widget name", () => {
    expect(widgetFormSchema.parse({ name: "  Launch checklist  " })).toEqual({
      name: "Launch checklist"
    });
  });

  it("rejects empty and overlong names", () => {
    expect(widgetFormSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(widgetFormSchema.safeParse({ name: "x".repeat(201) }).success).toBe(
      false
    );
  });
});
