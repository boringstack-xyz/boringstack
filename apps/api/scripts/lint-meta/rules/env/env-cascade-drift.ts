import { existsSync } from "node:fs";
import { join } from "node:path";

import { parseDotenvKeys } from "../../parsers/dotenv";
import { parseTypeboxEnvSchemaKeys } from "../../parsers/typebox-env-schema";
import type { IMetaRule, IViolation } from "../../types";

export function checkEnvSchemaDrift(root: string): IViolation[] {
  const schemaFile = join(root, "src", "config", "env", "schema.ts");
  const envExampleFile = join(root, ".env.example");

  if (!existsSync(schemaFile) || !existsSync(envExampleFile)) {
    return [];
  }

  const schemaKeys = parseTypeboxEnvSchemaKeys(schemaFile);
  const schemaSet = new Set(schemaKeys.map((k) => k.name));
  const envKeys = parseDotenvKeys(envExampleFile);
  const violations: IViolation[] = [];

  for (const key of envKeys) {
    if (!schemaSet.has(key)) {
      violations.push({
        file: envExampleFile,
        rule: "env-cascade-drift",
        message: `\`${key}\` is in .env.example but not in src/config/env/schema.ts — the API no longer reads it, or the key was renamed.`,
      });
    }
  }

  for (const { name, hasDefault } of schemaKeys) {
    if (hasDefault) {
      continue;
    }

    if (!envKeys.has(name)) {
      violations.push({
        file: schemaFile,
        rule: "env-cascade-drift",
        message: `\`${name}\` is required in schema.ts (no default) but missing from .env.example — operators have no seed value.`,
      });
    }
  }

  return violations;
}

/** schema.ts and .env.example must stay in sync. */
export const envCascadeDriftRule: IMetaRule = {
  id: "env-cascade-drift",
  category: "env",
  description:
    "TypeBox env schema keys must align with .env.example documentation.",
  run({ root }) {
    return checkEnvSchemaDrift(root);
  },
};
