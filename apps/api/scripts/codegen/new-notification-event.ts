#!/usr/bin/env bun
/**
 * Scaffolds a new notification event:
 *   - src/api/notifications/events/<filename>.event.ts (typed event def)
 *   - Appends the import + array entry to events/index.ts
 *
 * Usage: bun run new:notification-event -- comment.replied
 *        bun run new:notification-event -- billing.invoice_paid
 *
 * The name is `<feature>.<verb-past>` in dot notation; the filename is
 * the same string with dots replaced by hyphens.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EVENTS_DIR = fileURLToPath(
  new URL("../../src/api/notifications/events/", import.meta.url)
);

const BARREL_PATH = `${EVENTS_DIR}index.ts`;

const parseEventName = (argv: readonly string[]): string => {
  const arg = argv.slice(2).find((value) => value !== "--");
  const name = arg?.trim();

  if (name === undefined || name === "") {
    console.error(
      "Usage: bun run new:notification-event -- <feature>.<verb-past>\nExample: bun run new:notification-event -- comment.replied"
    );
    process.exit(1);
  }

  if (
    !/^[a-z][\da-z]*(?:_[\da-z]+)*(?:\.[a-z][\da-z]*(?:_[\da-z]+)*)+$/.test(
      name
    )
  ) {
    console.error(
      `Invalid event name "${name}". Use lowercase dot-segmented names with optional underscores, e.g. "comment.replied" or "billing.invoice_paid".`
    );
    process.exit(1);
  }

  return name;
};

const toFilename = (eventName: string): string => eventName.replace(/\./g, "-");

const toExportIdentifier = (eventName: string): string => {
  const camelBody = eventName
    .split(/[._-]/)
    .map((part, idx) => {
      if (idx === 0) {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");

  return `${camelBody}Event`;
};

const toReadableTitle = (eventName: string): string => {
  const parts = eventName.split(/[._-]/);
  const titled = parts.map(
    (part) => part.charAt(0).toUpperCase() + part.slice(1)
  );

  return titled.join(" ");
};

const buildEventFile = (
  eventName: string,
  identifier: string,
  title: string
): string => `import { t } from "elysia";

import { defineNotificationEvent } from "../../../lib/notifications";

/**
 * Notification event: ${title}.
 *
 * Replace the schema, default channels, and render functions with the
 * shape your domain actually needs. Author-facing handlers (\`render.inApp\`,
 * \`render.email\`, \`dedup.key\`, \`selfActionGuard\`) receive a typed
 * \`payload\` derived from \`schema\` — no manual narrowing needed.
 */
export const ${identifier} = defineNotificationEvent({
  type: "${eventName}",
  schema: t.Object({
    actorId: t.String({ format: "uuid" }),
  }),
  defaultChannels: ["in-app"],
  render: {
    inApp: ({ payload }) => ({
      title: "${title}",
      body: \`Triggered by \${payload.actorId}\`,
    }),
  },
});
`;

const patchBarrel = async (
  identifier: string,
  filename: string
): Promise<void> => {
  const content = await readFile(BARREL_PATH, "utf8");

  if (content.includes(`from "./${filename}.event"`)) {
    throw new Error(`Event "${filename}" is already registered in the barrel`);
  }

  const importLine = `import { ${identifier} } from "./${filename}.event";\n`;
  const arrayMarker =
    "export const allEvents: readonly INotificationEventDefinition<unknown>[] = [";
  const markerIndex = content.indexOf(arrayMarker);

  if (markerIndex === -1) {
    throw new Error(
      `Could not locate the \`allEvents\` array marker in ${BARREL_PATH}. Has the barrel been hand-edited?`
    );
  }

  const lastImportRegex = /(^import .+?;\n)(?!import )/m;
  const withImport = lastImportRegex.exec(content)
    ? content.replace(
        /^(import .+?;\n)(?!import )/m,
        (match) => `${match}${importLine}`
      )
    : `${importLine}${content}`;

  const closingBracket = "];";
  const arrayStartInNew = withImport.indexOf(arrayMarker);
  const closingIndex = withImport.indexOf(closingBracket, arrayStartInNew);

  if (closingIndex === -1) {
    throw new Error(
      `Could not locate the closing \`]\` of \`allEvents\` in ${BARREL_PATH}.`
    );
  }

  const existing = withImport
    .slice(arrayStartInNew + arrayMarker.length, closingIndex)
    .trim();
  const tokens = existing
    .replace(/[\n\r]/g, " ")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  tokens.push(identifier);

  const indentedBody = `\n  ${tokens.join(",\n  ")},\n`;
  const patched =
    withImport.slice(0, arrayStartInNew + arrayMarker.length) +
    indentedBody +
    withImport.slice(closingIndex);

  await writeFile(BARREL_PATH, patched, "utf8");
};

const main = async (): Promise<void> => {
  const eventName = parseEventName(process.argv);
  const filename = toFilename(eventName);
  const identifier = toExportIdentifier(eventName);
  const title = toReadableTitle(eventName);
  const eventFilePath = `${EVENTS_DIR}${filename}.event.ts`;

  if (existsSync(eventFilePath)) {
    console.error(`Event file already exists: ${eventFilePath}`);
    process.exit(1);
  }

  await writeFile(eventFilePath, buildEventFile(eventName, identifier, title));
  await patchBarrel(identifier, filename);

  console.log(`✅ Created event "${eventName}"`);
  console.log(`   ${eventFilePath}`);
  console.log(`   Identifier: ${identifier}`);
  console.log(`   Registered in: ${BARREL_PATH}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Edit the schema + render functions to match your domain.");
  console.log(
    "  2. Call `notifications.send(<identifier>, { ... })` from your service."
  );
};

await main();
