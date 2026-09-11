import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("pre-push scripts preserve configured targets, failures and local state", () => {
  const script = fileURLToPath(
    new URL("../../scripts/ci/pre-push-regression.sh", import.meta.url)
  );
  const output = execFileSync("/bin/bash", [script], {
    encoding: "utf8",
    timeout: 30_000,
  });

  expect(
    output.split("\n").filter((line) => line.startsWith("PASS "))
  ).toHaveLength(9);
}, 35_000);
