import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreferenceRow } from "./PreferenceRow";

describe("PreferenceRow", () => {
  it("renders one PreferenceCell per channel", () => {
    render(
      <table>
        <tbody>
          <PreferenceRow
            row={{
              eventType: "comment.replied",
              channels: { "in-app": true, email: false }
            }}
            channels={["in-app", "email"]}
            onToggle={vi.fn()}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText("comment.replied")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(2);
  });
});
