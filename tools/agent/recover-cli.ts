import { fileURLToPath } from "node:url";
import { recoverWorkspace } from "./workspace-lock";

const args = process.argv.slice(2).filter((first) => first !== "--");

try {
  if (
    args.length !== 2 ||
    (args[0] !== "checkout" && args[0] !== "generator") ||
    args[1] !== "--acknowledge-partial-writes"
  ) {
    throw new Error(
      "Inspect the diff first, then use agent:recover -- <checkout|generator> --acknowledge-partial-writes"
    );
  }

  recoverWorkspace(fileURLToPath(new URL("../../", import.meta.url)), args[0]);
  console.log(
    "Dead writer lock removed; verify the inspected checkout before continuing."
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Recovery failed");
  process.exitCode = 2;
}
