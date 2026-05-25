import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PreferenceCell } from "./PreferenceCell";

function renderCell(props: Parameters<typeof PreferenceCell>[0]) {
  return render(
    <table>
      <tbody>
        <tr>
          <PreferenceCell {...props} />
        </tr>
      </tbody>
    </table>
  );
}

describe("PreferenceCell", () => {
  it("invokes onToggle with the event type and channel when clicked", async () => {
    const onToggle = vi.fn();

    renderCell({
      eventType: "comment.replied",
      channel: "email",
      enabled: false,
      onToggle
    });

    await userEvent.click(
      screen.getByRole("switch", { name: "comment.replied email" })
    );

    expect(onToggle).toHaveBeenCalledWith("comment.replied", "email");
  });
});
