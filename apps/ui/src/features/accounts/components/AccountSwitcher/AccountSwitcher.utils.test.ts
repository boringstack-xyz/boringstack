import { describe, expect, it, vi } from "vitest";

import { makeOnSelectHandler } from "./AccountSwitcher.utils";

describe("makeOnSelectHandler", () => {
  it("returns a factory that produces a zero-arg handler bound to the accountId", () => {
    const onSelect = vi.fn();
    const factory = makeOnSelectHandler(onSelect);
    const handler = factory("acc-1");

    handler();

    expect(onSelect).toHaveBeenCalledWith("acc-1");
  });

  it("produces a distinct handler per accountId so React identity is preserved", () => {
    const onSelect = vi.fn();
    const factory = makeOnSelectHandler(onSelect);
    const a = factory("acc-a");
    const b = factory("acc-b");

    a();
    b();

    expect(onSelect).toHaveBeenNthCalledWith(1, "acc-a");
    expect(onSelect).toHaveBeenNthCalledWith(2, "acc-b");
  });
});
