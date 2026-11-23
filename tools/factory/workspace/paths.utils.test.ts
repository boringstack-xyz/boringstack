import { describe, expect, test } from "bun:test";

import {
  branchFor,
  isSafeIssueId,
  isSlot,
  slotOfFileName,
  slotOfProject,
  slotPorts,
  stackProject,
} from "./paths.utils";

describe("slot paths", () => {
  test("a slot's project and ports follow the factory config", () => {
    expect(stackProject(3)).toBe("boringstack-s3");
    expect(slotPorts(3)).toEqual({
      ui: 7403,
      api: 7503,
      postgres: 7603,
      valkey: 7703,
    });
    expect(branchFor("demo-1")).toBe("factory/demo-1");
  });

  test("only the slot projects of this product are slots", () => {
    expect(slotOfProject("boringstack-s2")).toBe(2);
    expect(slotOfProject("boringstack-s0")).toBeUndefined();
    expect(slotOfProject("boringstack-s99")).toBeUndefined();
    expect(slotOfProject("boringstack-preview")).toBeUndefined();
    expect(slotOfProject("tinkercaster-s2")).toBeUndefined();
    expect(slotOfProject("boringstack-infra")).toBeUndefined();
  });

  test("slot files and slot numbers are read exactly", () => {
    expect(isSlot(1)).toBe(true);
    expect(isSlot(9)).toBe(false);
    expect(slotOfFileName("s4.json")).toBe(4);
    expect(slotOfFileName("s4.json.tmp")).toBeUndefined();
    expect(slotOfFileName("notes.json")).toBeUndefined();
  });

  test("issue ids become safe folder and branch names", () => {
    expect(isSafeIssueId("demo-1")).toBe(true);
    expect(isSafeIssueId("ABC.12_x")).toBe(true);
    expect(isSafeIssueId("../escape")).toBe(false);
    expect(isSafeIssueId("a/b")).toBe(false);
    expect(isSafeIssueId("-leading")).toBe(false);
    expect(isSafeIssueId("")).toBe(false);
  });
});
