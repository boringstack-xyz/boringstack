import { existsSync } from "node:fs";
import { join } from "node:path";

import { parseDotenvKeys } from "../../parsers/dotenv";
import {
  parseImportMetaEnvKeys,
  parseZodEnvSchemaKeys
} from "../../parsers/zod-env-schema";
import type { IMetaRule, IViolation } from "../../types";

const VITE_CONFIG_ONLY_ENV_KEYS = new Set(["VITE_API_PROXY_TARGET"]);
const VITE_BUILTIN_ENV_KEYS = new Set(["MODE", "DEV", "PROD"]);

export function checkUiEnvCascadeDrift(root: string): IViolation[] {
  const schemaFile = join(root, "src", "lib", "env", "schema.ts");
  const envExampleFile = join(root, ".env.example");
  const viteEnvFile = join(root, "src", "vite-env.d.ts");

  if (
    !existsSync(schemaFile) ||
    !existsSync(envExampleFile) ||
    !existsSync(viteEnvFile)
  ) {
    return [];
  }

  const schemaKeys = parseZodEnvSchemaKeys(schemaFile);
  const schemaSet = new Set(schemaKeys.map((entry) => entry.name));
  const envKeys = parseDotenvKeys(envExampleFile);
  const importMetaKeys = parseImportMetaEnvKeys(viteEnvFile);
  const violations: IViolation[] = [];

  for (const key of envKeys) {
    if (VITE_CONFIG_ONLY_ENV_KEYS.has(key)) {
      if (!importMetaKeys.has(key)) {
        violations.push({
          file: viteEnvFile,
          rule: "env-cascade-drift",
          message: `\`${key}\` is documented in .env.example but missing from src/vite-env.d.ts.`
        });
      }

      continue;
    }

    if (!schemaSet.has(key)) {
      violations.push({
        file: envExampleFile,
        rule: "env-cascade-drift",
        message: `\`${key}\` is in .env.example but not in src/lib/env/schema.ts.`
      });
    }

    if (!importMetaKeys.has(key) && !VITE_BUILTIN_ENV_KEYS.has(key)) {
      violations.push({
        file: viteEnvFile,
        rule: "env-cascade-drift",
        message: `\`${key}\` is in .env.example but missing from src/vite-env.d.ts.`
      });
    }
  }

  for (const { name, hasDefault } of schemaKeys) {
    if (hasDefault || VITE_BUILTIN_ENV_KEYS.has(name)) {
      continue;
    }

    if (!envKeys.has(name)) {
      violations.push({
        file: schemaFile,
        rule: "env-cascade-drift",
        message: `\`${name}\` has no default in schema.ts but is missing from .env.example.`
      });
    }
  }

  return violations;
}

/** schema.ts, .env.example, and vite-env.d.ts must stay in sync. */
export const envCascadeDriftRule: IMetaRule = {
  id: "env-cascade-drift",
  category: "env",
  description:
    "Vite env keys must align across schema.ts, .env.example, and vite-env.d.ts.",
  run({ root }) {
    return checkUiEnvCascadeDrift(root);
  }
};
