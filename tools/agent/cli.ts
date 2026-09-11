import { fileURLToPath } from "node:url";
import { isProfile } from "./checks";
import { runProfile } from "./profiles";
import { exitCode } from "./result";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const profile =
  args.find((arg) => arg.startsWith("--profile="))?.slice(10) ?? "openapi";
const sandbox = args.find((arg) => arg.startsWith("--sandbox="))?.slice(10);
const controller = new AbortController();

process.once("SIGINT", () => {
  controller.abort();
});
process.once("SIGTERM", () => {
  controller.abort();
});

if (
  args.filter((arg) => arg.startsWith("--profile=")).length > 1 ||
  args.filter((arg) => arg.startsWith("--sandbox=")).length > 1 ||
  !isProfile(profile) ||
  args.some(
    (arg) =>
      arg !== "--json" &&
      !arg.startsWith("--profile=") &&
      !arg.startsWith("--sandbox=")
  )
) {
  console.log(
    JSON.stringify({
      schemaVersion: 1,
      status: "blocked",
      reason: "invalid_arguments",
    })
  );
  process.exitCode = 2;
} else {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const result = await runProfile(root, profile, sandbox, controller.signal);

  console.log(
    args.includes("--json")
      ? JSON.stringify(result)
      : [
          `${result.profile}: ${result.status}`,
          ...result.checks.map(
            (check) => `${check.checkId}: ${check.status} (${check.reason})`
          ),
        ].join("\n")
  );
  process.exitCode = exitCode(result.status);
}
