import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  claimFirstFreeSlot,
  claimSlot,
  heldSlots,
  parseClaim,
  readClaim,
  releaseClaim,
} from "./claims";

const withShared = (run: (shared: string) => void): void => {
  const shared = mkdtempSync(join(tmpdir(), "factory-claims-"));

  try {
    run(shared);
  } finally {
    rmSync(shared, { recursive: true, force: true });
  }
};

const work = {
  workspace: "/work/boringstack-workspaces/demo-1",
  issue: "demo-1",
  branch: "factory/demo-1",
};

describe("slot claims", () => {
  test("a slot can be claimed once; the second claim is refused", () => {
    withShared((shared) => {
      expect(claimSlot(shared, 1, work)?.slot).toBe(1);
      expect(claimSlot(shared, 1, { ...work, issue: "other" })).toBeUndefined();
      expect(readClaim(shared, 1)?.issue).toBe("demo-1");
    });
  });

  test("the lowest free slot is taken, and freed by release", () => {
    withShared((shared) => {
      expect(claimFirstFreeSlot(shared, work)?.slot).toBe(1);
      expect(
        claimFirstFreeSlot(shared, { ...work, issue: "demo-2" })?.slot
      ).toBe(2);
      expect(heldSlots(shared)).toEqual([1, 2]);
      releaseClaim(shared, 1);
      expect(
        claimFirstFreeSlot(shared, { ...work, issue: "demo-3" })?.slot
      ).toBe(1);
    });
  });

  test("a claim file that is not a claim is ignored when read", () => {
    expect(parseClaim({ slot: 1 })).toBeUndefined();
    expect(
      parseClaim({
        slot: 12,
        workspace: "/x",
        issue: "a",
        branch: "b",
        createdAt: "c",
      })
    ).toBeUndefined();
    expect(
      parseClaim({
        slot: 1,
        workspace: "/x",
        issue: "a",
        branch: "b",
        createdAt: "c",
      })?.slot
    ).toBe(1);
  });
});
