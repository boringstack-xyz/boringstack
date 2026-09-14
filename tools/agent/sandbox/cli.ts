import { fileURLToPath } from "node:url";
import {
  downSandbox,
  inspectSandbox,
  publicSandbox,
  upSandbox,
} from "./lifecycle";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const [action, ...rest] = process.argv.slice(2).filter((arg) => arg !== "--");

try {
  const id = rest.find((arg) => arg.startsWith("--id="))?.slice(5);

  if (rest.some((arg) => arg !== "--json" && !arg.startsWith("--id="))) {
    throw new Error("Invalid arguments");
  }

  if (action === "up" && id === undefined) {
    console.log(JSON.stringify(publicSandbox(await upSandbox(root))));
  } else if (action === "down" && id !== undefined) {
    await downSandbox(root, id);
    console.log(JSON.stringify({ status: "removed", id }));
  } else if (action === "inspect" && id !== undefined) {
    console.log(JSON.stringify(publicSandbox(await inspectSandbox(root, id))));
  } else {
    throw new Error("Use up, inspect --id=<id>, or down --id=<id>");
  }
} catch (error) {
  console.log(
    JSON.stringify({
      schemaVersion: 1,
      status: "blocked",
      reason:
        error instanceof Error && error.message.startsWith("sandbox_not_found:")
          ? "sandbox_not_found"
          : "sandbox_operation_failed",
      next: "Inspect the sandbox and Docker runtime; use sandbox:up when the descriptor is missing.",
    })
  );
  process.exitCode = 2;
}
