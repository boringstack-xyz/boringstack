import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSupportButton } from "./SupportButton.hooks";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe("useSupportButton", () => {
  it("passes the open handler through and names the button", () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() => useSupportButton({ onOpen }));

    expect(result.current.onOpen).toBe(onOpen);
    expect(result.current.text).toBe("support.ask");
    expect(result.current.label).toBe("support.askLabel");
  });
});
