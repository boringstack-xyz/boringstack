import { describe, expect, test } from "bun:test";

import { COMMANDS, resolveCommand } from "./commands";

describe("factory commands", () => {
  test("every command name is unique", () => {
    const names = COMMANDS.map((command) => command.name);

    expect(new Set(names).size).toBe(names.length);
  });

  test("the longest matching name wins and the rest are arguments", () => {
    expect(resolveCommand(["workspace", "new", "ISSUE-1"])?.command.name).toBe(
      "workspace new"
    );
    expect(resolveCommand(["workspace", "new", "ISSUE-1"])?.args).toEqual([
      "ISSUE-1",
    ]);
    expect(resolveCommand(["fleet", "serve"])?.command.name).toBe(
      "fleet serve"
    );
    expect(resolveCommand(["fleet"])?.command.name).toBe("fleet");
    expect(resolveCommand(["nope"])).toBeUndefined();
  });
});
