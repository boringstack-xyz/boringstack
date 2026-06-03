import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const EXPRESSION_OPENER = "${{";
const EXPRESSION_CLOSER = "}}";

/*
 * GitHub lexes every expression opener in a workflow file — including
 * ones inside run-block heredocs, embedded Python, or comments — as the
 * start of an Actions expression. A stray opener (e.g. an f-string
 * emitting one) fails that lexing and invalidates the ENTIRE workflow:
 * runs fail in 0s with no jobs, and required PR checks hang at
 * "Expected". The lex-level failure class this catches: an opener
 * immediately followed by another `{` (the f-string triple-brace
 * footgun) or an opener with no closer on the same line. Full
 * expression-grammar validation is actionlint's job; this rule only
 * blocks the variants that brick the whole file.
 */
export function checkWorkflowExpressionSyntax(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const lines = readFileSync(file, "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    let cursor = 0;

    for (;;) {
      const start = line.indexOf(EXPRESSION_OPENER, cursor);

      if (start === -1) {
        break;
      }

      const malformed =
        line[start + EXPRESSION_OPENER.length] === "{" ||
        !line.includes(EXPRESSION_CLOSER, start + EXPRESSION_OPENER.length);

      if (malformed) {
        violations.push({
          file,
          rule: "github-actions-expression-syntax",
          message: `Line ${String(index + 1)} contains an expression opener (dollar + double brace) that is not a well-formed Actions expression — GitHub lexes every opener (even in scripts or comments) and a malformed one invalidates the whole workflow.`
        });
      }

      cursor = start + EXPRESSION_OPENER.length;
    }
  }

  return violations;
}

/**
 * One malformed expression opener anywhere in a workflow file makes the
 * whole workflow unparseable — runs fail instantly with zero jobs.
 */
export const githubActionsExpressionSyntaxRule: IMetaRule = {
  id: "github-actions-expression-syntax",
  category: "ci",
  description:
    "Every expression opener in a workflow must be a well-formed Actions expression.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowExpressionSyntax);
  }
};
