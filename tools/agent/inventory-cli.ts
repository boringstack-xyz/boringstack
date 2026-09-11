import { fileURLToPath } from "node:url";
import {
  acceptInventories,
  isInventoryLane,
  reviewInventories,
} from "./inventory";
import { acquireWorkspace } from "./workspace-lock";

const args = process.argv.slice(2).filter((first) => first !== "--");
const lanes = args.filter((arg) => !arg.startsWith("--"));
const accept = args.find((arg) => arg.startsWith("--accept="))?.slice(9);
const removals = args
  .find((arg) => arg.startsWith("--allow-removals="))
  ?.slice(17);
let release: (() => void) | undefined;

try {
  release = acquireWorkspace(fileURLToPath(new URL("../../", import.meta.url)));

  if (
    lanes.length === 0 ||
    new Set(args.map((arg) => arg.split("=")[0])).size !== args.length ||
    !lanes.every(isInventoryLane) ||
    args.some(
      (arg) =>
        arg.startsWith("--") &&
        !/^--(?:accept|allow-removals)=[a-f0-9]{64}$/.test(arg)
    )
  ) {
    throw new Error(
      "Use agent:inventory -- <api.tests|ui.tests|ui.e2e>; review the resulting case diff"
    );
  }

  const root = fileURLToPath(new URL("../../", import.meta.url));
  const review = reviewInventories(root, lanes);

  console.log(
    JSON.stringify(
      {
        fingerprint: review.fingerprint,
        token: review.token,
        changes: review.changes.map((change) => ({
          lane: change.lane,
          beforeCount: change.before.length,
          afterCount: change.after.length,
          added: change.added,
          removed: change.removed,
        })),
      },
      null,
      2
    )
  );

  if (accept !== undefined) {
    acceptInventories(root, lanes, accept, removals);
    console.log("Approved inventory applied.");
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Inventory update failed"
  );
  process.exitCode = 2;
} finally {
  release?.();
}
