import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const CANONICAL_LOCALE = join(
  "src",
  "lib",
  "i18n",
  "locales",
  "en",
  "common.json"
);

/*
 * The cross-repo i18n-keys plugin guarantees every `t("…")` literal has a
 * locale entry (used → defined). This rule closes the other direction
 * (defined → used): a leaf key nobody references is dead translation
 * surface that still costs every locale a translated string.
 *
 * A key counts as used when its full dotted path appears as a string
 * literal anywhere in src (covers indirect `labelKey:` config tables),
 * or when it sits under a prefix that some `t(`…${…}`)` template builds
 * dynamically (e.g. auth.oauth.${provider}).
 */
function flattenKeys(value: unknown, prefix: string, out: string[]): void {
  if (typeof value !== "object" || value === null) {
    out.push(prefix);

    return;
  }

  for (const [key, child] of Object.entries(value)) {
    flattenKeys(child, prefix === "" ? key : `${prefix}.${key}`, out);
  }
}

const DYNAMIC_PREFIX_REGEX = /t\(\s*`([^`$]+)\$\{/gu;

export function checkI18nLocaleKeysUsed(
  root: string,
  sourceFiles: readonly string[]
): IViolation[] {
  const localePath = join(root, CANONICAL_LOCALE);
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(localePath, "utf8"));
  } catch {
    return [];
  }

  const keys: string[] = [];

  flattenKeys(parsed, "", keys);

  const sources = sourceFiles
    .filter((file) => !file.includes("/locales/"))
    .map((file) => readFileSync(file, "utf8"));
  const corpus = sources.join("\n");
  const dynamicPrefixes: string[] = [];

  for (const match of corpus.matchAll(DYNAMIC_PREFIX_REGEX)) {
    const prefix = match[1];

    if (prefix !== undefined) {
      dynamicPrefixes.push(prefix);
    }
  }

  const violations: IViolation[] = [];

  for (const key of keys) {
    if (dynamicPrefixes.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    if (!corpus.includes(`"${key}"`) && !corpus.includes(`'${key}'`)) {
      violations.push({
        file: localePath,
        rule: "i18n-locale-keys-used",
        message: `Locale key \`${key}\` is defined but never referenced in src — dead translation surface (remove it from every locale, or wire it up).`
      });
    }
  }

  return violations;
}

/** Every locale leaf key must be referenced somewhere in src. */
export const i18nLocaleKeysUsedRule: IMetaRule = {
  id: "i18n-locale-keys-used",
  category: "source-text",
  description:
    "Locale keys defined in en/common.json must be referenced in src (dynamic t() prefixes exempt).",
  run({ root, sourceFiles }) {
    return checkI18nLocaleKeysUsed(root, sourceFiles);
  }
};
