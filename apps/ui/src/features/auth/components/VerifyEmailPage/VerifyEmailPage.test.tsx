import { MemoryRouter } from "react-router-dom";
import type * as ReactRouterDom from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import VerifyEmailPage from "./VerifyEmailPage";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof ReactRouterDom>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

function renderAt(url: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
  navigateMock.mockReset();
  /*
   * verify-email hook now pre-fetches /me through
   * `syncMeAfterSessionEstablished`. Stub the follow-up call so the
   * helper resolves immediately on the success path.
   */
  apiMock.GET.mockResolvedValue({
    data: { user: { id: "u1", email: "u@example.com" } }
  });
});

describe("VerifyEmailPage", () => {
  it("renders the verifying state immediately while the POST is in flight", () => {
    apiMock.POST.mockReturnValue(
      new Promise<never>(() => {
        /* never resolves: holds the verifying state in view */
      })
    );
    renderAt("/verify-email?token=test-verify-token-fixture");

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/verify-email", {
      body: { token: "test-verify-token-fixture" }
    });
  });

  it("renders missing-token state when no ?token= is present", () => {
    renderAt("/verify-email");

    expect(screen.getByRole("alert", { hidden: false })).toBeInTheDocument();
    /*
     * Tests render without an i18n provider, so the raw translation key
     * shows up as visible text — `verifyEmail.missingToken`.
     */
    expect(
      screen.getByText("auth.verifyEmail.missingToken")
    ).toBeInTheDocument();
    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("renders invalid-token state when the API responds 400", async () => {
    apiMock.POST.mockRejectedValueOnce(
      new ApiError(400, { message: "Invalid or expired" })
    );
    renderAt("/verify-email?token=expiredtokenexpiredtoken");

    await waitFor(() => {
      expect(
        screen.getByText("auth.verifyEmail.invalidToken")
      ).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to /dashboard on success", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: undefined, response: {} });
    renderAt("/verify-email?token=goodtokengoodtokengoodtoken");

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", {
        replace: true
      });
    });
  });

  it("renders generic error state for unexpected server failures", async () => {
    apiMock.POST.mockRejectedValueOnce(
      new ApiError(500, { message: "Server error" })
    );
    renderAt("/verify-email?token=goodtokengoodtokengoodtoken");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
