import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { useSignUpPage } from "./SignUpPage.hooks";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en" }
    })
  };
});

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useSignUpPage", () => {
  it("starts with submittedEmail = null and isSubmitting = false", () => {
    const { result } = renderHook(() => useSignUpPage(), {
      wrapper: makeWrapper()
    });

    expect(result.current.submittedEmail).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isResending).toBe(false);
  });

  it("exposes register, submit, errors, onResend handles", () => {
    const { result } = renderHook(() => useSignUpPage(), {
      wrapper: makeWrapper()
    });

    expect(typeof result.current.register).toBe("function");
    expect(typeof result.current.submit).toBe("function");
    expect(typeof result.current.onResend).toBe("function");
    expect(result.current.errors).toEqual({});
  });
});
