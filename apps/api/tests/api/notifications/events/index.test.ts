import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Import-cycle guard. The `lib/notifications` barrel re-exports dispatch and
 * channels, which reach `config/setup`, which registers these very event
 * files. An event file that imports the barrel re-enters the cycle and can
 * leave `defineNotificationEvent` in its temporal dead zone. Event files must
 * import the helper and types from their own modules.
 */
const EVENTS_DIR = join(
  import.meta.dir,
  "../../../../src/api/notifications/events"
);

const BARREL_IMPORT = /from "[^"]*\/lib\/notifications";/;

const sourceFiles = readdirSync(EVENTS_DIR).filter((name) =>
  name.endsWith(".ts")
);

describe("notification event files", () => {
  test("there are event files to check", () => {
    expect(
      sourceFiles.filter((name) => name.endsWith(".event.ts")).length
    ).toBeGreaterThan(0);
  });

  test.each(sourceFiles)(
    "%s imports from its own modules, not the lib/notifications barrel",
    (name) => {
      const source = readFileSync(join(EVENTS_DIR, name), "utf8");

      expect(BARREL_IMPORT.test(source)).toBe(false);
    }
  );
});
