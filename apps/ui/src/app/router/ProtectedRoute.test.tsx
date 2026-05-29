import { MemoryRouter, Route, Routes } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "./ProtectedRoute";

const meMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/Auth.queries", () => ({
  useMe: meMock
}));

function renderWithRoutes(initialEntries: string[]) {
  const client = new QueryClient();

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path='/dashboard'
            element={
              <ProtectedRoute>
                <div data-testid='protected-content'>Secret stuff</div>
              </ProtectedRoute>
            }
          />
          <Route path='/login' element={<div data-testid='login'>Login</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProtectedRoute", () => {
  it("renders a spinner while useMe is pending", () => {
    meMock.mockReturnValue({ data: undefined, isPending: true });
    renderWithRoutes(["/dashboard"]);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("redirects to /login when the user is unauthenticated", () => {
    meMock.mockReturnValue({ data: null, isPending: false });
    renderWithRoutes(["/dashboard"]);
    expect(screen.getByTestId("login")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("renders the children when the user is authenticated", () => {
    meMock.mockReturnValue({
      data: {
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        },
        account: { id: "acc1", name: "Acc" },
        role: "owner",
        memberships: [{ accountId: "acc1", accountName: "Acc", role: "owner" }],
        features: {
          can_export: false,
          can_invite_team: false,
          max_seats: 1
        },
        capabilities: {
          billing: false,
          notificationsSse: false,
          webPush: false
        }
      },
      isPending: false
    });
    renderWithRoutes(["/dashboard"]);
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });
});
