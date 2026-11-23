import { renderHook } from "@testing-library/react";
import { CircleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";

import { useIconBadge } from "./IconBadge.hooks";

describe("useIconBadge", () => {
  it("defaults to the outline tone and merges the caller's classes", () => {
    const { result } = renderHook(() =>
      useIconBadge({ icon: CircleAlert, className: "shadow-sm" })
    );

    expect(result.current.className).toContain("rounded-full");
    expect(result.current.className).toContain("shadow-sm");
  });

  it("picks the tone's classes", () => {
    const { result } = renderHook(() =>
      useIconBadge({ icon: CircleAlert, tone: "soft" })
    );

    expect(result.current.className).toContain("bg-primary-low");
  });
});
