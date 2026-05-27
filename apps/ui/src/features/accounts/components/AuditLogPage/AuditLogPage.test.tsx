import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditLogPage } from "./AuditLogPage";

const useAuditLogPageMock = vi.hoisted(() => vi.fn());

vi.mock("./AuditLogPage.hooks", () => ({
  useAuditLogPage: useAuditLogPageMock
}));

function baseView(overrides: Record<string, unknown> = {}) {
  return {
    pageTitle: "accounts.auditLog.pageTitle",
    pageSubtitle: "accounts.auditLog.pageSubtitle",
    systemFallback: "accounts.auditLog.systemActor",
    loadingLabel: "accounts.auditLog.loading",
    errorMessage: "accounts.auditLog.error",
    emptyMessage: "accounts.auditLog.empty",
    isPending: false,
    isError: false,
    isSuccess: false,
    entries: [],
    ...overrides
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuditLogPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  useAuditLogPageMock.mockReset();
});

describe("AuditLogPage", () => {
  it("renders skeleton rows while the query is pending", () => {
    useAuditLogPageMock.mockReturnValue(baseView({ isPending: true }));

    renderPage();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the empty-state copy when the query succeeds with no entries", async () => {
    useAuditLogPageMock.mockReturnValue(
      baseView({ isSuccess: true, entries: [] })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("accounts.auditLog.empty")).toBeInTheDocument();
    });
  });

  it("renders one row per entry, action + actor visible", async () => {
    useAuditLogPageMock.mockReturnValue(
      baseView({
        isSuccess: true,
        entries: [
          {
            id: "e1",
            action: "auth.login_success",
            resource: "account:acc-1",
            metadata: {},
            createdAt: "2026-05-27T12:00:00.000Z",
            actorUserId: "u1",
            actorEmail: "alex@example.com",
            actorFirstName: "Alex",
            actorLastName: "Owner"
          }
        ]
      })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("audit-log-row")).toBeInTheDocument();
    });
    expect(screen.getByText(/Auth login success/i)).toBeInTheDocument();
    expect(screen.getByText(/Alex Owner/i)).toBeInTheDocument();
  });

  it("renders the alert when the query errors", () => {
    useAuditLogPageMock.mockReturnValue(baseView({ isError: true }));

    renderPage();

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
