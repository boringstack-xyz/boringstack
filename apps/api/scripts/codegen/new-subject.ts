import { appendToTuple } from "./acl-scaffold/edit-tuple";
import { printPunchList } from "./acl-scaffold/punch-list";

const name = process.argv[2];

if (name === undefined || name === "") {
  console.error("Usage: bun run new:subject <SubjectName>");
  console.error('Example: bun run new:subject "Webhook"');
  process.exit(1);
}

if (!/^[A-Z][\dA-Za-z]*$/.test(name)) {
  console.error(
    `Subject name '${name}' must be PascalCase starting with a capital letter.`
  );
  process.exit(1);
}

const changed = appendToTuple("SUBJECTS", name);

if (!changed) {
  console.log(`Subject '${name}' already exists. Nothing to do.`);
  process.exit(0);
}

printPunchList("subject", name);

console.log(
  "Reminder: account-scoped subjects also need a tagged interface in"
);
console.log(
  "src/lib/acl/acl.types.ts (e.g. `interface IWebhookSubject extends"
);
console.log('ForcedSubject<"Webhook"> { accountId: string }`) and an entry in');
console.log("the SubjectInstance union.");
console.log("");
