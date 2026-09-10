import { fileURLToPath } from "node:url";
import { acceptInventories, isInventoryLane } from "./inventory";
import { acquireWorkspace } from "./workspace-lock";

const args = process.argv.slice(2).filter((first) => first !== "--");
let release: (() => void) | undefined;

try {
  release = acquireWorkspace(fileURLToPath(new URL("../../", import.meta.url)));

  if (
    args.length === 0 ||
    new Set(args).size !== args.length ||
    !args.every(isInventoryLane)
  ) {
    throw new Error(
      "Use agent:inventory -- <api.tests|ui.tests|ui.e2e>; review the resulting case diff"
    );
  }

  acceptInventories(fileURLToPath(new URL("../../", import.meta.url)), args);
  console.log(
    "Inventory updated. Review the added and removed case identities before accepting it."
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Inventory update failed"
  );
  process.exitCode = 2;
} finally {
  release?.();
}
