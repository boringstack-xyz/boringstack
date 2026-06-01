import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Copies the canonical ACL type spine from apps/api to
 * apps/ui so the two workspace apps stay byte-identical on Role / Action /
 * Subject / FeatureKey unions. Mirrors the existing
 * `generate:api[:check]` pattern.
 *
 * Mode:
 *   - default ("write"): copy and overwrite the generated file
 *   - "check":           fail with exit 1 when the generated file
 *                        drifts from the source
 *
 * Workspace location resolution:
 *   - `BORINGSTACK_UI_DIR` env var if set
 *   - otherwise `../ui` relative to the apps/api root
 */

const SOURCE_REL = "src/lib/acl/acl.constants.ts";
const DEST_REL = "src/lib/acl/acl.types.generated.ts";

const apiTemplateRoot = resolve(import.meta.dir, "../..");

const resolveUiTemplateRoot = (): string => {
  const fromEnv = process.env.BORINGSTACK_UI_DIR;

  if (fromEnv !== undefined && fromEnv !== "") {
    return resolve(fromEnv);
  }

  return resolve(apiTemplateRoot, "..", "ui");
};

const HEADER = `/*
 * AUTO-GENERATED — do not edit. Run \`bun run generate:acl-types\` in the
 * apps/api workspace to refresh this file. Drift between this file and
 * apps/api/${SOURCE_REL} fails CI via
 * \`bun run generate:acl-types:check\`.
 */
`;

const main = (): void => {
  const mode = process.argv.includes("--check") ? "check" : "write";
  const uiRoot = resolveUiTemplateRoot();
  const sourcePath = join(apiTemplateRoot, SOURCE_REL);
  const destPath = join(uiRoot, DEST_REL);

  if (!existsSync(sourcePath)) {
    console.error(`source missing: ${sourcePath}`);
    process.exit(1);

    return;
  }

  const sourceContent = readFileSync(sourcePath, "utf8");
  const generated = `${HEADER}\n${sourceContent}`;

  if (mode === "check") {
    if (!existsSync(destPath)) {
      console.error(
        `[generate:acl-types:check] missing: ${destPath} — run bun run generate:acl-types`
      );
      process.exit(1);

      return;
    }

    const current = readFileSync(destPath, "utf8");

    if (current !== generated) {
      console.error(
        `[generate:acl-types:check] DRIFT detected: ${destPath} differs from ${sourcePath}`
      );
      process.exit(1);

      return;
    }

    console.log("[generate:acl-types:check] up-to-date");

    return;
  }

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, generated, "utf8");
  console.log(`[generate:acl-types] wrote ${destPath}`);
};

main();
