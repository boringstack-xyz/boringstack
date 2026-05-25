import { appendToTuple } from "./acl-scaffold/edit-tuple";
import { printPunchList } from "./acl-scaffold/punch-list";

const name = process.argv[2];

if (name === undefined || name === "") {
  console.error("Usage: bun run new:action <action-name>");
  console.error('Example: bun run new:action "archive"');
  process.exit(1);
}

if (!/^[a-z][\d_a-z]*$/.test(name)) {
  console.error(
    `Action name '${name}' must be lowercase snake_case (a-z, 0-9, _).`
  );
  process.exit(1);
}

const changed = appendToTuple("ACTIONS", name);

if (!changed) {
  console.log(`Action '${name}' already exists. Nothing to do.`);
  process.exit(0);
}

printPunchList("action", name);
