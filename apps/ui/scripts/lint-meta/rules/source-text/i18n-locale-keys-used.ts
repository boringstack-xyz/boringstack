import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const CANONICAL_LOCALE = join("src", "lib", "i18n", "locales", "en");

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

function checkDictionary(
  localePath: string,
  sourceFiles: readonly string[]
): IViolation[] {
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

    // i18next resolves count-based calls to CLDR-suffixed leaf keys.
    const baseKey = key.replace(
      /_(?:ordinal_)?(?:zero|one|two|few|many|other)$/u,
      ""
    );
    const references = [key, baseKey];

    if (
      !references.some(
        (reference) =>
          corpus.includes(`"${reference}"`) || corpus.includes(`'${reference}'`)
      )
    ) {
      violations.push({
        file: localePath,
        rule: "i18n-locale-keys-used",
        message: `Locale key \`${key}\` is defined but never referenced in src — dead translation surface. Remove it from every locale, or reference it: string literals count, and so do template literals whose prefix is literal (t(\`section.\${value}\`)); a template whose prefix is a variable (t(\`\${prefix}.\${value}\`)) cannot be followed statically.`
      });
    }
  }

  return violations;
}

export function checkI18nLocaleKeysUsed(
  root: string,
  sourceFiles: readonly string[]
): IViolation[] {
  const directory = join(root, CANONICAL_LOCALE);

  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => checkDictionary(join(directory, file), sourceFiles));
}

/** Every locale leaf key must be referenced somewhere in src. */
export const i18nLocaleKeysUsedRule: IMetaRule = {
  id: "i18n-locale-keys-used",
  category: "source-text",
  description:
    "Locale keys defined in en/*.json must be referenced in src (dynamic t() prefixes exempt).",
  run({ root, sourceFiles }) {
    return checkI18nLocaleKeysUsed(root, sourceFiles);
  }
};
