import { fileURLToPath } from "node:url";
import { inspectTask } from "./tasks";

try {
  const args = process.argv
    .slice(2)
    .filter((first) => first !== "--" && first !== "--json");

  if (args.length !== 1) {
    throw new Error("Task ID required");
  }

  console.log(
    JSON.stringify(
      inspectTask(
        fileURLToPath(new URL("../../", import.meta.url)),
        args[0] ?? ""
      )
    )
  );
} catch {
  console.log(
    JSON.stringify({
      schemaVersion: 1,
      status: "blocked",
      reason: "invalid_task_contract",
    })
  );
  process.exitCode = 2;
}
