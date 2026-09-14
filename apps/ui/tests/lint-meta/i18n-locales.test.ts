import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

function translationKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    expect(value.trim(), `Empty translation: ${prefix}`).not.toBe("");

    return [
      prefix.replace(/_(?:ordinal_)?(?:zero|one|two|few|many|other)$/u, "")
    ];
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid translation at ${prefix}`);
  }

  return Object.entries(value).flatMap(([key, child]) =>
    translationKeys(child, prefix === "" ? key : `${prefix}.${key}`)
  );
}

test("all shipped locale namespaces contain matching non-empty translations", () => {
  const root = join(process.cwd(), "src/lib/i18n/locales");
  const namespaces = readdirSync(join(root, "en"))
    .filter((name) => name.endsWith(".json"))
    .sort();

  expect(namespaces.length).toBeGreaterThan(0);

  for (const locale of readdirSync(root, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory()
  )) {
    expect(
      readdirSync(join(root, locale.name))
        .filter((name) => name.endsWith(".json"))
        .sort()
    ).toEqual(namespaces);

    for (const namespace of namespaces) {
      const canonical: unknown = JSON.parse(
        readFileSync(join(root, "en", namespace), "utf8")
      );
      const translated: unknown = JSON.parse(
        readFileSync(join(root, locale.name, namespace), "utf8")
      );

      expect([...new Set(translationKeys(translated))].sort()).toEqual(
        [...new Set(translationKeys(canonical))].sort()
      );
    }
  }
});
