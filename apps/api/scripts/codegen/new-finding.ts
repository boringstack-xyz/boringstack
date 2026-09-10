#!/usr/bin/env bun
/**
 * Scaffolds a security-spec finding:
 *   - security-spec/<id>-<slug>.test.ts (an expected-red case + its control)
 *   - Appends the matching row to security-spec/findings.json
 *
 * Usage: bun run new:finding -- F19 high "invitation tokens are not rotated"
 *
 * The suite this writes into is expected to FAIL. Each test asserts the
 * behaviour the finding says is missing, so a red run means the finding is
 * outstanding and a green run means it is fixed. See security-spec/README.md.
 *
 * The generated file carries two cases because the two lint:meta rules over
 * this directory reject anything less: `security-spec-no-silent-bail` (no
 * bailing guards, no skips) and `security-spec-requires-control` (every
 * describe declares its own `control:` case).
 *
 * Everything worth testing lives in `new-finding-lib.ts`; this is the runner.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildManifest,
  buildSpecFile,
  parseArgs,
  parseError,
  specFileName,
} from "./new-finding-lib";

const SPEC_DIR = fileURLToPath(
  new URL("../../security-spec/", import.meta.url)
);

const MANIFEST_PATH = `${SPEC_DIR}findings.json`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const main = async (): Promise<void> => {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed.ok) {
    fail(parsed.error);

    return;
  }

  const { args } = parsed;
  const file = specFileName(args);
  const path = `${SPEC_DIR}${file}`;

  if (existsSync(path)) {
    fail(`Spec file already exists: ${path}`);
  }

  const content = buildSpecFile(args);

  /*
   * Both outputs are built before either is written, so a title that breaks
   * the generated TypeScript cannot leave a manifest row pointing at a file
   * that does not compile.
   */
  const syntaxError = parseError(content, path);

  if (syntaxError !== undefined) {
    fail(
      `Refusing to write ${path}: the generated file does not parse — ${syntaxError}\n` +
        "This is a generator bug. Please report the title you used."
    );
  }

  const manifest = buildManifest(
    await readFile(MANIFEST_PATH, "utf8"),
    args,
    file
  );

  await writeFile(path, content);
  await writeFile(MANIFEST_PATH, manifest, "utf8");

  console.log(`✅ Scaffolded ${args.id} (${args.severity})`);
  console.log(`   ${path}`);
  console.log(`   Manifest row added to ${MANIFEST_PATH}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Replace the file header with the evidence for the claim.");
  console.log(
    "  2. Write the failing assertion against the specific wrong value."
  );
  console.log("  3. Make the control exercise the same fixture, allowed path.");
  console.log(
    "  4. `bun run test:security`, then `bun run write:security-manifest`"
  );
  console.log("     and read the diff — it should be only your two cases.");
};

await main();
