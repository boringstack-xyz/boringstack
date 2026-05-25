import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type * as ReactRouterDom from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOAuthCallbackPage } from "./OAuthCallbackPage.hooks";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof ReactRouterDom>("react-router-dom");

  return { ...actual, useNavigate: () => navigateMock };
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

function makeWrapper(initialUrl: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return { Wrapper };
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("useOAuthCallbackPage", () => {
  it("surfaces a friendly message when ?error=... is present and does not navigate", async () => {
    const { Wrapper } = makeWrapper("/oauth/success?error=access_denied");
    const { result } = renderHook(() => useOAuthCallbackPage(), {
      wrapper: Wrapper
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.errorMessage).toBe(
      "auth.oauth.failed.errors.access_denied"
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to the post-OAuth path when no error is present", async () => {
    const { Wrapper } = makeWrapper("/oauth/success");

    renderHook(() => useOAuthCallbackPage(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
    });
  });
});
