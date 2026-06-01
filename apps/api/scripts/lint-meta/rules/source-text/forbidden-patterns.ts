export interface IForbiddenTextPattern {
  readonly rule: string;
  readonly pattern: RegExp;
  readonly message: string;
}

export function createForbiddenTextPatterns(): IForbiddenTextPattern[] {
  return [
    {
      rule: "no-inline-lint-disable",
      pattern: /\beslint-disable(?:-next-line|-line)?\b/u,
      message:
        "Inline ESLint disables are not allowed. Fix the rule or add a scoped config override.",
    },
    {
      rule: "no-ts-ignore",
      pattern: /@ts-(?:ignore|expect-error)/u,
      message:
        "TypeScript suppression comments are not allowed. Narrow the type instead.",
    },
  ];
}
