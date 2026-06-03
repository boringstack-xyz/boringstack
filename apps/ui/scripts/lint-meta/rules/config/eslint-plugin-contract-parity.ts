import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const PLUGIN_PREFIX = "@boring-stack-pkg/eslint-plugin-";
const CONTRACT_FILE = "AGENT_CONTRACT.md";

/*
 * AGENT_CONTRACT.md is the first document agents read; its plugin table
 * is the canonical map of what `bun run check` enforces. Two installed
 * plugins (code-flow, comment-hygiene) were missing from it — and one
 * row referenced a plugin that was never installed in that app — so
 * the contract silently drifted from package.json. Parity both ways:
 * every installed plugin must be mentioned, and every mentioned plugin
 * must be installed.
 */
export function checkEslintPluginContractParity(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const contractPath = join(root, CONTRACT_FILE);
  const packagePath = join(root, "package.json");

  if (!existsSync(contractPath) || !existsSync(packagePath)) {
    return violations;
  }

  const contract = readFileSync(contractPath, "utf8");
  const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"));

  if (typeof parsed !== "object" || parsed === null) {
    return violations;
  }

  const devDependencies =
    "devDependencies" in parsed ? parsed.devDependencies : undefined;

  if (typeof devDependencies !== "object" || devDependencies === null) {
    return violations;
  }

  const installed = Object.keys(devDependencies)
    .filter((name) => name.startsWith(PLUGIN_PREFIX))
    .map((name) => name.slice(PLUGIN_PREFIX.length));

  for (const shortName of installed) {
    if (!contract.includes(shortName)) {
      violations.push({
        file: contractPath,
        rule: "eslint-plugin-contract-parity",
        message: `Installed plugin \`${PLUGIN_PREFIX}${shortName}\` is not documented in ${CONTRACT_FILE} — the contract's plugin table must cover everything \`bun run check\` enforces.`
      });
    }
  }

  const mentioned = contract.matchAll(
    /@boring-stack-pkg\/eslint-plugin-([a-z0-9-]+)/gu
  );
  const installedSet = new Set(installed);

  for (const match of mentioned) {
    const shortName = match[1];

    if (shortName !== undefined && !installedSet.has(shortName)) {
      violations.push({
        file: contractPath,
        rule: "eslint-plugin-contract-parity",
        message: `${CONTRACT_FILE} documents \`${PLUGIN_PREFIX}${shortName}\` but it is not installed in this app's package.json — remove or correct the row.`
      });
    }
  }

  return violations;
}

/** AGENT_CONTRACT.md's plugin table must match package.json, both ways. */
export const eslintPluginContractParityRule: IMetaRule = {
  id: "eslint-plugin-contract-parity",
  category: "config",
  description:
    "Every installed @boring-stack-pkg eslint plugin must appear in AGENT_CONTRACT.md, and vice versa.",
  run({ root }) {
    return checkEslintPluginContractParity(root);
  }
};
