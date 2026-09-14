import { fileURLToPath } from "node:url";
import { recoverLease } from "./sandbox/lease";
import { recoverWorkspace } from "./workspace-lock";

const args = process.argv.slice(2).filter((first) => first !== "--");

try {
  if (
    args.length === 3 &&
    args[0] === "lease" &&
    args[1]?.startsWith("--id=") === true &&
    args[2] === "--acknowledge-partial-writes"
  ) {
    recoverLease(
      fileURLToPath(new URL("../../", import.meta.url)),
      args[1].slice(5)
    );
  } else if (
    args.length !== 2 ||
    (args[0] !== "checkout" && args[0] !== "generator") ||
    args[1] !== "--acknowledge-partial-writes"
  ) {
    throw new Error(
      "Inspect partial writes first; use agent:recover -- <checkout|generator|lease --id=ID> --acknowledge-partial-writes"
    );
  } else {
    recoverWorkspace(
      fileURLToPath(new URL("../../", import.meta.url)),
      args[0]
    );
  }

  console.log(
    "Dead writer lock removed; verify the inspected checkout before continuing."
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Recovery failed");
  process.exitCode = 2;
}
