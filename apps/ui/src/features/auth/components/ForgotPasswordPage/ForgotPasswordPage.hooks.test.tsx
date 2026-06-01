import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useForgotPasswordPage } from "./ForgotPasswordPage.hooks";

vi.mock("@/lib/api/client", () => ({
  apiClient: { POST: vi.fn() }
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } })
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe("useForgotPasswordPage", () => {
  it("starts with no submitted email", () => {
    const { result } = renderHook(() => useForgotPasswordPage(), {
      wrapper: wrapper()
    });

    expect(result.current.submittedEmail).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });
});
