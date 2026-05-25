import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePreferenceRow } from "./PreferenceRow.hooks";

describe("usePreferenceRow", () => {
  it("returns one cell descriptor per channel, in input order", () => {
    const { result } = renderHook(() =>
      usePreferenceRow({
        row: {
          eventType: "auth.login",
          channels: { "in-app": true, email: false }
        },
        channels: ["in-app", "email"],
        onToggle: vi.fn()
      })
    );

    expect(result.current.cells.map((c) => c.channel)).toEqual([
      "in-app",
      "email"
    ]);
    expect(result.current.cells[0]?.enabled).toBe(true);
    expect(result.current.cells[1]?.enabled).toBe(false);
  });

  it("defaults enabled to false for a channel the row doesn't know about", () => {
    const { result } = renderHook(() =>
      usePreferenceRow({
        row: { eventType: "auth.login", channels: { "in-app": true } },
        channels: ["in-app", "sms"],
        onToggle: vi.fn()
      })
    );

    expect(result.current.cells[1]).toEqual({ channel: "sms", enabled: false });
  });

  it("forwards onToggle untouched", () => {
    const onToggle = vi.fn();
    const { result } = renderHook(() =>
      usePreferenceRow({
        row: { eventType: "auth.login", channels: {} },
        channels: [],
        onToggle
      })
    );

    expect(result.current.onToggle).toBe(onToggle);
  });
});
