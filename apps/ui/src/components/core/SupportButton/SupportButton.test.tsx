import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SupportButton } from "./SupportButton";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe("SupportButton", () => {
  it("calls the open handler when pressed", () => {
    const onOpen = vi.fn();

    render(<SupportButton onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "support.askLabel" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
