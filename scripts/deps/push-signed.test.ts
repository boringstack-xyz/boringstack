import { describe, expect, test } from "bun:test";

import { fileChanges } from "./push-signed.mjs";

describe("fileChanges", () => {
  test("maps added, modified and deleted paths", () => {
    const read = (path: string) => Buffer.from(`content of ${path}`);

    expect(fileChanges("M\0apps/ui/package.json\0A\0new.txt\0D\0old.txt\0", read)).toEqual({
      additions: [
        { path: "apps/ui/package.json", contents: Buffer.from("content of apps/ui/package.json").toString("base64") },
        { path: "new.txt", contents: Buffer.from("content of new.txt").toString("base64") },
      ],
      deletions: [{ path: "old.txt" }],
    });
  });

  test("an empty diff has no changes", () => {
    expect(fileChanges("", () => Buffer.from(""))).toEqual({ additions: [], deletions: [] });
  });
});
