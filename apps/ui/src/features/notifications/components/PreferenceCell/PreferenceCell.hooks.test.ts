import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePreferenceCell } from "./PreferenceCell.hooks";

describe("usePreferenceCell", () => {
  it("invokes onToggle with the cell's eventType + channel when handleChange fires", () => {
    const onToggle = vi.fn();
    const { result } = renderHook(() =>
      usePreferenceCell({
        eventType: "auth.login_success",
        channel: "email",
        onToggle,
        enabled: true
      })
    );

    result.current.handleChange();

    expect(onToggle).toHaveBeenCalledWith("auth.login_success", "email");
  });

  it("recomputes handleChange when the upstream props change", () => {
    const onToggle = vi.fn();
    const { result, rerender } = renderHook(
      (props: { eventType: string; channel: string }) =>
        usePreferenceCell({
          eventType: props.eventType,
          channel: props.channel,
          onToggle,
          enabled: false
        }),
      { initialProps: { eventType: "evt.a", channel: "in-app" } }
    );

    result.current.handleChange();
    rerender({ eventType: "evt.b", channel: "email" });
    result.current.handleChange();

    expect(onToggle).toHaveBeenNthCalledWith(1, "evt.a", "in-app");
    expect(onToggle).toHaveBeenNthCalledWith(2, "evt.b", "email");
  });
});
