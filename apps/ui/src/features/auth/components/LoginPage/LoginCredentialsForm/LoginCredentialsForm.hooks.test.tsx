import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLoginCredentialsForm } from "./LoginCredentialsForm.hooks";

describe("useLoginCredentialsForm", () => {
  it("returns hasOAuthProviders=false when the list is empty", () => {
    const { result } = renderHook(() =>
      useLoginCredentialsForm({ oauthProviders: [] })
    );

    expect(result.current.hasOAuthProviders).toBe(false);
  });

  it("returns hasOAuthProviders=true when at least one provider is present", () => {
    const { result } = renderHook(() =>
      useLoginCredentialsForm({ oauthProviders: ["google"] })
    );

    expect(result.current.hasOAuthProviders).toBe(true);
  });
});
