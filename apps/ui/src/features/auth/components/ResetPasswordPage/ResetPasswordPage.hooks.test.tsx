import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useResetPasswordPage } from "./ResetPasswordPage.hooks";

vi.mock("@/lib/api/client", () => ({
  apiClient: { POST: vi.fn() }
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } })
}));

function wrapper(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe("useResetPasswordPage", () => {
  it("reports missingToken when no token query param is present", () => {
    const { result } = renderHook(() => useResetPasswordPage(), {
      wrapper: wrapper(["/reset-password"])
    });

    expect(result.current.state).toBe("missingToken");
  });

  it("starts in form state when a token is present", () => {
    const { result } = renderHook(() => useResetPasswordPage(), {
      wrapper: wrapper(["/reset-password?token=test-reset-token-fixture"])
    });

    expect(result.current.state).toBe("form");
    expect(result.current.isSubmitting).toBe(false);
  });
});
