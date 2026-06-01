import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ActivityFeed from "./ActivityFeed";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

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

function renderFeed() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <ActivityFeed />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.GET.mockReset();
});

describe("ActivityFeed", () => {
  it("renders the populated list when the query resolves with items", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: {
        items: [
          { id: "a1", title: "Alice signed up", timestamp: "2026-01-01" },
          { id: "a2", title: "Bob upgraded plan", timestamp: "2026-01-02" }
        ],
        nextCursor: null
      },
      response: {}
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByText("Alice signed up")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob upgraded plan")).toBeInTheDocument();
  });

  it("renders the empty state when the API returns zero items", async () => {
    apiMock.GET.mockResolvedValueOnce({
      data: { items: [], nextCursor: null },
      response: {}
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByText("dashboard.activity.empty")).toBeInTheDocument();
    });
  });
});
