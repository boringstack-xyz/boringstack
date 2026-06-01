import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OwnershipTransferAcceptPage from "./OwnershipTransferAcceptPage";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function renderAt(url: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <OwnershipTransferAcceptPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("OwnershipTransferAcceptPage", () => {
  it("renders the idle state with Accept and Decline buttons when token is present", () => {
    renderAt("/account/ownership-transfer/accept?token=demo-token-32");

    expect(
      screen.getByRole("button", { name: "accounts.ownershipTransfer.accept" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "accounts.ownershipTransfer.decline" })
    ).toBeInTheDocument();
    expect(apiMock.POST).not.toHaveBeenCalled();
  });

  it("renders missing-token state when no ?token= is present", () => {
    renderAt("/account/ownership-transfer/accept");

    expect(
      screen.getByText("accounts.ownershipTransfer.missingToken")
    ).toBeInTheDocument();
  });

  it("fires the accept endpoint on Accept click", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { id: "ot1" }, timestamp: "t" }
    });
    renderAt("/account/ownership-transfer/accept?token=tok");

    fireEvent.click(
      screen.getByRole("button", { name: "accounts.ownershipTransfer.accept" })
    );

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith(
        "/api/v1/invitations/ownership-transfer/accept",
        { body: { token: "tok" } }
      );
    });
  });

  it("fires the decline endpoint on Decline click", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { id: "ot1" }, timestamp: "t" }
    });
    renderAt("/account/ownership-transfer/accept?token=tok");

    fireEvent.click(
      screen.getByRole("button", { name: "accounts.ownershipTransfer.decline" })
    );

    await waitFor(() => {
      expect(apiMock.POST).toHaveBeenCalledWith(
        "/api/v1/invitations/ownership-transfer/decline",
        { body: { token: "tok" } }
      );
    });
  });
});
