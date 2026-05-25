import type { ReactNode } from "react";

import { subject } from "@casl/ability";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildAbility } from "./ability";
import { AbilityContext, emptyAbility } from "./acl.context";
import { useCan } from "./useCan";

const ACCOUNT_ID = "acc-1";

describe("useCan", () => {
  it("returns the empty ability when no provider wraps the tree", () => {
    const { result } = renderHook(() => useCan());

    expect(result.current).toBe(emptyAbility);
    expect(result.current.can("read", "Widget")).toBe(false);
  });

  it("returns the ability provided by the context", () => {
    const ability = buildAbility("owner", ACCOUNT_ID, {
      can_export: true,
      can_invite_team: true,
      max_seats: 10,
      max_widgets: 50
    });

    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <AbilityContext.Provider value={ability}>
        {children}
      </AbilityContext.Provider>
    );

    const { result } = renderHook(() => useCan(), { wrapper });

    expect(
      result.current.can(
        "update",
        subject("Widget", { id: "w1", accountId: ACCOUNT_ID })
      )
    ).toBe(true);
  });
});
