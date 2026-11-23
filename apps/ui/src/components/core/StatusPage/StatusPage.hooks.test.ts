import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useStatusPage } from "./StatusPage.hooks";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: () => "BoringStack" })
}));

describe("useStatusPage", () => {
  it("titles the tab as the page, then the app name", () => {
    const { result } = renderHook(() =>
      useStatusPage({ metaTitle: "Link expired" })
    );

    expect(result.current.documentTitle).toBe("Link expired · BoringStack");
  });
});
