import { resolve } from "node:path";

export interface IForbiddenTextPattern {
  readonly rule: string;
  readonly pattern: RegExp;
  readonly message: string;
  readonly allow?: (file: string) => boolean;
}

export function createForbiddenTextPatterns(
  root: string
): IForbiddenTextPattern[] {
  const rawFetchAllowlist = new Set([resolve(root, "src/lib/api/openapi.ts")]);

  return [
    {
      /*
       * Inline disables hide real lint debt. Fix the rule or add a scoped
       * eslint.config override instead.
       */
      rule: "no-inline-lint-disable",
      pattern: /\beslint-disable(?:-next-line|-line)?\b/u,
      message:
        "Inline ESLint disables are not allowed. Fix the rule or add a scoped config override."
    },
    {
      /*
       * @ts-ignore papers over type holes. Narrow types or fix the underlying
       * mismatch instead.
       */
      rule: "no-ts-ignore",
      pattern: /@ts-(?:ignore|expect-error)/u,
      message:
        "TypeScript suppression comments are not allowed. Narrow the type instead."
    },
    {
      /*
       * Raw HTML injection is an XSS footgun unless routed through a reviewed
       * sanitizer.
       */
      rule: "no-dangerous-html",
      pattern: /\bdangerouslySetInnerHTML\b/u,
      message:
        "Raw HTML rendering requires a dedicated sanitizer and security review."
    },
    {
      /*
       * Env reads must go through src/lib/env so validation and typing stay
       * centralized.
       */
      rule: "env-access",
      pattern: /\bimport\.meta\.env\b/u,
      message: "Read Vite env through src/lib/env only.",
      allow: (file) => file.startsWith(resolve(root, "src/lib/env"))
    },
    {
      /*
       * All HTTP traffic goes through the typed OpenAPI client except the
       * transport layer itself.
       */
      rule: "no-raw-fetch",
      pattern: /\bfetch\s*\(/u,
      message:
        "Use the typed apiClient; raw fetch is restricted to src/lib/api/openapi.ts.",
      allow: (file) => rawFetchAllowlist.has(file)
    },
    {
      /*
       * Casting a value to an inline object type (`x as { … }`) skips
       * runtime validation — the classic footgun is asserting the shape of
       * a parsed JSON / API response body and trusting it. The merge bar is
       * "only `as const`"; ESLint's consistent-type-assertions only bans
       * object-literal *expressions* (`{} as T`), not assertions *to* an
       * inline object type, so this closes that gap for production source.
       * Narrow the value with a type guard instead (see
       * src/lib/api/openapi.ts `extractApiErrorBody`). Tests, e2e, and
       * Storybook keep casting for fixtures, so the ban is src-only and
       * skips colocated `*.test.*` files.
       */
      rule: "no-inline-object-cast",
      pattern: /\bas\s+\{/u,
      message:
        "Casting to an inline object type (`as { … }`) skips validation. Narrow the value with a type guard instead.",
      allow: (file) =>
        !file.startsWith(resolve(root, "src")) ||
        /\.test\.(?:ts|tsx)$/u.test(file)
    },
    {
      /*
       * Theme tokens in tailwind.css are the only source of truth for
       * light/dark. Components must reference semantic tokens
       * (bg-background, text-foreground, ...) and never branch on the
       * `dark:` Tailwind variant. The regex requires a lowercase letter
       * directly after `dark:` so it catches `dark:bg-foo` and
       * `dark:hover:text-bar` while leaving JS object literals like
       * `{ dark: false }` (space after colon) and `data-theme="dark"`
       * (no trailing colon) untouched.
       */
      rule: "no-dark-variant",
      pattern: /\bdark:[a-z]/u,
      message:
        "The `dark:` Tailwind variant is banned. Theme tokens in src/assets/css/tailwind.css are the source of truth — use semantic classes (bg-background, text-foreground, ...)."
    }
  ];
}
