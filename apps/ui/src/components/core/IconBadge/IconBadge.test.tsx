import { render } from "@testing-library/react";
import { CircleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IconBadge } from "./IconBadge";

describe("IconBadge", () => {
  it("renders a decorative icon tile in the danger tone", () => {
    const { container } = render(
      <IconBadge icon={CircleAlert} tone='danger' className='mx-2' />
    );
    const badge = container.querySelector("[data-slot='icon-badge']");

    expect(badge).toHaveClass("text-destructive", "mx-2");
    expect(badge?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("defaults to the outline tone", () => {
    const { container } = render(<IconBadge icon={CircleAlert} />);

    expect(container.querySelector("[data-slot='icon-badge']")).toHaveClass(
      "rounded-full",
      "border"
    );
  });
});
