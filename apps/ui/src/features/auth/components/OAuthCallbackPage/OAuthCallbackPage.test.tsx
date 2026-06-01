import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import OAuthCallbackPage from "./OAuthCallbackPage";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

/*
 * useOAuthCallbackPage's effect calls `syncMeAfterSessionEstablished`
 * which fires GET /me. Default the GET mock to an authed envelope so
 * the helper resolves on the first attempt and the promise doesn't
 * leak as an unhandled rejection when openapi-fetch hits the real
 * (relative) URL.
 */
apiMock.GET.mockResolvedValue({
  data: { user: { id: "u1", email: "u@example.com" } }
});

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

function renderAt(url: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <OAuthCallbackPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("OAuthCallbackPage", () => {
  it("shows a friendly OAuth error message when ?error=... is present", () => {
    renderAt("/oauth/success?error=access_denied");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("auth.oauth.failed.errors.access_denied")
    ).toBeInTheDocument();
  });

  it("renders the in-progress state when there is no error param", () => {
    renderAt("/oauth/success");
    /*
     * The default state is "exchanging" while the query invalidation +
     * navigation kick off; no alert role should be visible.
     */
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
