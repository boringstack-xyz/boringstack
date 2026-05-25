import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Can } from "./Can";
import { buildAbility } from "./ability";
import { AbilityContext, emptyAbility } from "./acl.context";

function Wrap({
  ability,
  children
}: {
  ability: typeof emptyAbility;
  children: ReactNode;
}): ReactNode {
  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}

describe("<Can>", () => {
  it("renders children when the ability allows the action on the subject", () => {
    const ability = buildAbility("owner", "acc-1", {
      can_export: true,
      can_invite_team: true,
      max_seats: 10,
      max_widgets: 100
    });

    render(
      <Wrap ability={ability}>
        <Can I='manage' a='Widget'>
          <button type='button'>Create widget</button>
        </Can>
      </Wrap>
    );

    expect(
      screen.getByRole("button", { name: "Create widget" })
    ).toBeInTheDocument();
  });

  it("hides children when the ability denies the action", () => {
    const ability = buildAbility("viewer", "acc-1", {
      can_export: false,
      can_invite_team: false,
      max_seats: 1,
      max_widgets: 5
    });

    render(
      <Wrap ability={ability}>
        <Can I='update' a='Widget'>
          <button type='button'>Edit</button>
        </Can>
      </Wrap>
    );

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("with the empty ability (pre-/me) renders nothing", () => {
    render(
      <Wrap ability={emptyAbility}>
        <Can I='read' a='Widget'>
          <span data-testid='gated'>visible</span>
        </Can>
      </Wrap>
    );

    expect(screen.queryByTestId("gated")).toBeNull();
  });
});
