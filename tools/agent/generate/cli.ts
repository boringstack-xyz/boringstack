import { fileURLToPath } from "node:url";
import { planAccountResource } from "./account-resource";
import { formatEdits } from "./format";
import { apply } from "./patch";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2).filter((first) => first !== "--");

try {
  const name = args.find((first) => !first.startsWith("--")) ?? "";
  const policy =
    args.find((first) => first.startsWith("--policy="))?.slice(9) ?? "";

  if (
    args.filter((first) => first.startsWith("--policy=")).length !== 1 ||
    args.filter((first) => !first.startsWith("--")).length !== 1 ||
    args.some(
      (first) =>
        first !== name &&
        first !== "--scope=account" &&
        first !== "--dry-run" &&
        first !== "--json" &&
        !first.startsWith("--policy=")
    )
  ) {
    throw new Error("Unsupported argument");
  }

  const edits = await formatEdits(
    root,
    planAccountResource(root, name, policy)
  );

  apply(root, edits, args.includes("--dry-run"));
  console.log(
    JSON.stringify({
      schemaVersion: 1,
      status: args.includes("--dry-run") ? "planned" : "generated",
      paths: edits.map((plannedEdit) => plannedEdit.path),
      next: [
        "Generate and apply the migration in an owned sandbox",
        "Regenerate ACL and OpenAPI types",
        "Run the account-resource acceptance recipe",
      ],
    })
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Generation failed");
  process.exitCode = 2;
}
