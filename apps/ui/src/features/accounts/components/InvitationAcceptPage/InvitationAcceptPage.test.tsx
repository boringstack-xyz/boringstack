import { MemoryRouter } from "react-router-dom";
import type * as ReactRouterDom from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import InvitationAcceptPage from "./InvitationAcceptPage";

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
        <InvitationAcceptPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.POST.mockReset();
  navigateMock.mockReset();
});

describe("InvitationAcceptPage", () => {
  it("POSTs the token immediately on mount and renders the accepting state", () => {
    apiMock.POST.mockReturnValue(
      new Promise<never>(() => {
        /* never resolves: holds the accepting state in view */
      })
    );
    renderAt("/invitations/accept?token=test-invitation-token-fixture");

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/invitations/accept", {
      body: { token: "test-invitation-token-fixture" }
    });
  });

  it("renders missing-token state when no ?token= is present", () => {
    renderAt("/invitations/accept");

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("accounts.invitations.accept.missingToken")
    ).toBeInTheDocument();
    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("renders invalid-token state when the API responds 4xx", async () => {
    apiMock.POST.mockRejectedValueOnce(
      new ApiError(400, { message: "Invalid token" })
    );
    renderAt("/invitations/accept?token=expired");

    await waitFor(() => {
      expect(
        screen.getByText("accounts.invitations.accept.errorInvalid")
      ).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to /account/invitations on success", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: undefined, response: {} });
    renderAt("/invitations/accept?token=valid-token");

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/account/invitations", {
        replace: true
      });
    });
  });
});
