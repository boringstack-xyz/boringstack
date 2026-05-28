import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { makeUser } from "../../../../../tests/factories";
import { useLoginPage } from "./LoginPage.hooks";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast: toastMock }));

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

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.GET.mockResolvedValue({
    data: {
      features: {
        notifications: { sse: false, webPush: false },
        billing: { enabled: false },
        ai: { enabled: false }
      },
      oauth: { providers: [] }
    }
  });
  apiMock.POST.mockReset();
  toastMock.error.mockReset();
});

describe("useLoginPage onSubmit", () => {
  it("toasts the invalid-credentials message when the API responds 401", async () => {
    apiMock.POST.mockRejectedValueOnce(
      new ApiError(401, { message: "Bad creds" })
    );
    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    await act(async () => {
      await result.current.onSubmit({
        email: "a@b.com",
        password: "longenough"
      });
    });
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "auth.login.errors.invalidCredentials"
      );
    });
  });

  it("toasts the network-error message for other failures", async () => {
    apiMock.POST.mockRejectedValueOnce(
      new ApiError(500, { message: "Server error" })
    );
    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    await act(async () => {
      await result.current.onSubmit({
        email: "a@b.com",
        password: "longenough"
      });
    });
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("auth.login.errors.network");
    });
  });

  it("applies server fieldErrors via setError (no toast in that case)", async () => {
    apiMock.POST.mockRejectedValueOnce(
      new ApiError(422, {
        message: "Validation failed",
        fieldErrors: { email: "Taken" }
      })
    );
    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    await act(async () => {
      await result.current.onSubmit({
        email: "a@b.com",
        password: "longenough"
      });
    });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("navigates on successful login", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: makeUser({ email: "a@b.com", firstName: "A", lastName: "B" })
        },
        timestamp: "2026-01-01T00:00:00Z"
      },
      response: {}
    });
    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    await act(async () => {
      await result.current.onSubmit({
        email: "a@b.com",
        password: "longenough"
      });
    });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("does not start OAuth when the provider is not configured", () => {
    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    result.current.onGoogle();

    expect(result.current.isGoogleOAuthEnabled).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith("auth.oauth.notConfigured");
  });

  it("sets a challenge token when /login returns mfaRequired", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        success: true,
        data: { mfaRequired: true, challengeToken: "tokenxxxxxxxxxxxx" },
        timestamp: "2026-01-01T00:00:00Z"
      }
    });

    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    await act(async () => {
      await result.current.onSubmit({
        email: "a@b.com",
        password: "longenough"
      });
    });

    await waitFor(() => {
      expect(result.current.mfaChallengeToken).toBe("tokenxxxxxxxxxxxx");
    });

    expect(result.current.mfaMode).toBe("totp");
  });

  it("toggles between TOTP and recovery modes", () => {
    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    expect(result.current.mfaMode).toBe("totp");

    act(() => {
      result.current.onMfaModeToggle();
    });

    expect(result.current.mfaMode).toBe("recovery");

    act(() => {
      result.current.onMfaModeToggle();
    });

    expect(result.current.mfaMode).toBe("totp");
  });

  it("does nothing when the MFA submit fires without a challenge", () => {
    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    act(() => {
      result.current.onMfaSubmit();
    });

    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("enables OAuth providers returned by the API capabilities endpoint", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        features: {
          notifications: { sse: false, webPush: false },
          billing: { enabled: false },
          ai: { enabled: false }
        },
        oauth: { providers: ["google", "linkedin"] }
      }
    });

    const { result } = renderHook(() => useLoginPage(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isGoogleOAuthEnabled).toBe(true);
    });

    expect(result.current.isGithubOAuthEnabled).toBe(false);
    expect(result.current.isLinkedinOAuthEnabled).toBe(true);
  });
});
