import type { IMetaContext, IMetaRule, IViolation } from "./types";

export function runMetaRules(
  rules: readonly IMetaRule[],
  ctx: IMetaContext
): IViolation[] {
  return rules.flatMap((rule) => rule.run(ctx));
}

export async function runMetaRulesAsync(
  rules: readonly IMetaRule[],
  ctx: IMetaContext
): Promise<IViolation[]> {
  const results: IViolation[][] = [];

  for (const rule of rules) {
    if (rule.runAsync !== undefined) {
      results.push(await rule.runAsync(ctx));
    }
  }

  return results.flat();
}

export function printRuleCatalog(rules: readonly IMetaRule[]): void {
  console.log("id\tcategory\tci-critical\tdescription");

  for (const rule of rules) {
    console.log(
      `${rule.id}\t${rule.category}\t${rule.ciCritical === true ? "yes" : "no"}\t${rule.description}`
    );
  }
}
