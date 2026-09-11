import { fileURLToPath } from "node:url";
import { runEvaluation } from "./evaluation-runner";
import { runIsolatedCandidate } from "./isolated/candidate";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2).filter((arg) => arg !== "--");

try {
  if (args.length === 1 && args[0] === "--deterministic") {
    process.exitCode = await runEvaluation(root);
  } else if (
    args.length === 1 &&
    args[0]?.startsWith("--candidate=") === true
  ) {
    process.exitCode = await runIsolatedCandidate(root, args[0].slice(12));
  } else {
    throw new Error("Use --deterministic or --candidate=/absolute/checkout");
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Evaluation unavailable"
  );
  process.exitCode = 2;
}
