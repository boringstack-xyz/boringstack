import { describe, expect, test } from "bun:test";

import {
  parseClaim,
  parsePreviewUrl,
  parseStatusLine,
  parseVerify,
  projectOfSlot,
  slotOfFileName,
  slotOfProject,
} from "./slots.utils";

describe("slot files", () => {
  test("a compose project names its slot", () => {
    expect(slotOfProject("boringstack-s3", "boringstack")).toBe(3);
    expect(slotOfProject("boringstack", "boringstack")).toBeNull();
    expect(slotOfProject("boringstack-s3-extra", "boringstack")).toBeNull();
    expect(slotOfProject("boringstackxs3", "boringstack")).toBeNull();
    expect(projectOfSlot("boringstack", 4)).toBe("boringstack-s4");
  });

  test("slot file names carry the slot", () => {
    expect(slotOfFileName("s2.json")).toBe(2);
    expect(slotOfFileName("2.json")).toBeNull();
    expect(slotOfFileName("s2.json.tmp")).toBeNull();
  });

  test("a claim needs a workspace; the rest is optional", () => {
    expect(parseClaim(1, { workspace: "/work/s1", issue: "APP-1" })).toEqual({
      slot: 1,
      workspace: "/work/s1",
      issue: "APP-1",
      branch: null,
      claimedAt: null,
    });
    expect(parseClaim(1, { issue: "APP-1" })).toBeNull();
    expect(parseClaim(1, "nope")).toBeNull();
  });

  test("status, preview and verify read tolerantly", () => {
    expect(parseStatusLine({ status: " Testing ", updatedAt: "t" })).toEqual({
      text: "Testing",
      at: "t",
    });
    expect(parseStatusLine({ status: "" })).toBeNull();
    expect(parsePreviewUrl({ url: "https://p" })).toBe("https://p");
    expect(parsePreviewUrl(null)).toBeNull();
    expect(
      parseVerify({ status: "failed", runId: "r1", finishedAt: "t" })
    ).toEqual({ ok: false, level: "failed", runId: "r1", at: "t" });
    expect(parseVerify({ status: "warn", runId: "r2" })?.ok).toBe(true);
    expect(parseVerify({ runId: "r3" })).toBeNull();
  });
});
