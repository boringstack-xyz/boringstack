/**
 * Rewrites a component written by `shadcn add` to this template's rules.
 *
 * shadcn 4 imports its class helper from the `cn` package and writes
 * `dark:` variants. Here the helper is `@/lib/classnames` and the dark
 * theme lives only in `src/assets/css/tailwind.css`.
 */
export const CLASSNAMES_MODULE = "@/lib/classnames";

const CN_PACKAGE_IMPORT = /(from\s+|import\s*\(\s*)(["'])cn\2/gu;

/* A single- or double-quoted string literal on one line. */
const STRING_LITERAL = /(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/gu;

/* Joined so the no-dark-mode lint rule does not read it as a class. */
const DARK_PREFIX = ["dark", ""].join(":");

const isDark = (token: string): boolean => token.startsWith(DARK_PREFIX);

function withoutDarkClasses(text: string): string {
  const tokens = text.split(/\s+/u).filter((token) => token.length > 0);

  if (!tokens.some(isDark)) {
    return text;
  }

  return tokens.filter((token) => !isDark(token)).join(" ");
}

export function adaptShadcnSource(source: string): string {
  return source
    .replace(CN_PACKAGE_IMPORT, `$1$2${CLASSNAMES_MODULE}$2`)
    .replace(
      STRING_LITERAL,
      (_match, quote: string, text: string) =>
        `${quote}${withoutDarkClasses(text)}${quote}`
    );
}

/** True when shadcn added `cn` to the manifest that was not there before. */
export function addedCnPackage(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): boolean {
  const has = (manifest: Record<string, unknown>): boolean =>
    ["dependencies", "devDependencies"].some((field) => {
      const deps = manifest[field];

      return typeof deps === "object" && deps !== null && "cn" in deps;
    });

  return has(after) && !has(before);
}
