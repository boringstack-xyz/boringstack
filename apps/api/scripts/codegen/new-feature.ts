import { appendFeature, appendToTuple } from "./acl-scaffold/edit-tuple";
import { printPunchList } from "./acl-scaffold/punch-list";

const name = process.argv[2];
const kindArg = process.argv[3];
const defaultArg = process.argv[4];

const isValidKind = (value: string | undefined): value is "boolean" | "limit" =>
  value === "boolean" || value === "limit";

if (name === undefined || name === "" || !isValidKind(kindArg)) {
  console.error(
    "Usage: bun run new:feature <feature_key> <boolean|limit> <default>"
  );
  console.error('Example: bun run new:feature "can_share" boolean false');
  console.error('Example: bun run new:feature "max_uploads" limit 25');
  process.exit(1);
}

if (!/^[a-z][\d_a-z]*$/.test(name)) {
  console.error(
    `Feature key '${name}' must be lowercase snake_case (a-z, 0-9, _).`
  );
  process.exit(1);
}

let defaultValue: boolean | number;

if (kindArg === "boolean") {
  if (defaultArg !== "true" && defaultArg !== "false") {
    console.error(
      `Boolean default must be 'true' or 'false', got '${defaultArg ?? ""}'`
    );
    process.exit(1);
  }

  defaultValue = defaultArg === "true";
} else {
  const parsed = Number(defaultArg);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    console.error(
      `Limit default must be an integer, got '${defaultArg ?? ""}'`
    );
    process.exit(1);
  }

  defaultValue = parsed;
}

const tupleChanged = appendToTuple("FEATURE_KEYS", name);
const objectChanged = appendFeature(name, kindArg, defaultValue);

if (!tupleChanged && !objectChanged) {
  console.log(`Feature '${name}' already exists. Nothing to do.`);
  process.exit(0);
}

printPunchList("feature", name);
