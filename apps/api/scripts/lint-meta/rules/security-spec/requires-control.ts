import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import ts from "typescript";

import { collectSourceFiles } from "../../context";
import type { IMetaRule, IViolation } from "../../types";

/*
 * Every `describe` in `security-spec/` needs at least one positive control.
 *
 * The suite is expected to be red, which removes the usual signal that a
 * fixture works. A finding's case can fail because the defect is real, or
 * because the seed data never landed, the login never issued a cookie, the
 * route was never reached. All three look identical in the report, and the
 * second and third are indistinguishable from evidence.
 *
 * A control is a case in the same fixture that must pass — the allowed path,
 * the request that should succeed, the account that does hold the feature. It
 * turns "this failed" into "this failed and the setup around it works", and
 * it is the only thing that catches a spec which has quietly stopped
 * exercising its condition — a seeded row that never landed, a login that
 * issued no cookie, a route that answers 404 because it is not mounted.
 *
 * The manifest reconciler enforces the same property at run time, but only
 * per finding — per file. This rule enforces it per fixture, which is the
 * level that actually matters once a file grows a nested suite.
 *
 * Parsed, not scanned
 * -------------------
 * This walks the TypeScript AST rather than matching lines, so comments are
 * not code, containment is lexical, and formatting is irrelevant. Line
 * matching has at least three false negatives, each of which makes the rule
 * pass a suite it should reject: a control that exists only inside a block
 * comment counts as real, a nested describe is credited with a control
 * declared later in its parent, and a case written as a multiline `test(`
 * call is invisible. A guardrail with false negatives is worse than none,
 * because it is trusted.
 *
 * What this rule does and does not police
 * ---------------------------------------
 * It counts cases per suite and requires a control among them. It does NOT
 * police case names: the suite has legitimate table-driven cases whose
 * titles are template literals over a static list, and those are counted
 * like any other. Names are reconciled against a real run by
 * `check:security-manifest`, which compares them exactly and is the
 * stronger check; duplicating it here as a syntactic guess would only
 * produce false positives on working specs.
 *
 * A `describe` with no callback IS reported: the rule genuinely cannot see
 * its cases, and silently returning "clean" is the false negative this rule
 * exists to avoid.
 */
const RULE_ID = "security-spec-requires-control";
const SPEC_DIR = "security-spec";
const CONTROL_PREFIX = /^\s*control:/u;

interface IBlock {
  readonly title: string;
  readonly line: number;
  /** Cases declared directly in this block, not in a nested one. */
  tests: number;
  controls: number;
}

interface IAnalysis {
  readonly blocks: IBlock[];
  readonly unsupported: { line: number; message: string }[];
}

/**
 * The leftmost identifier of a callee, so `describe`, `describe.each([…])`
 * and `describe.each([…])(…)` all resolve to "describe".
 */
function calleeBaseName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return calleeBaseName(expression.expression);
  }

  if (ts.isCallExpression(expression)) {
    return calleeBaseName(expression.expression);
  }

  return undefined;
}

/** The title, when it is a literal the rule can read at lint time. */
function staticTitle(call: ts.CallExpression): string | undefined {
  const [first] = call.arguments;

  if (first === undefined) {
    return undefined;
  }

  if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) {
    return first.text;
  }

  return undefined;
}

function callbackOf(call: ts.CallExpression): ts.Node | undefined {
  return call.arguments.find(
    (argument) =>
      ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
  );
}

function analyse(source: ts.SourceFile): IAnalysis {
  const blocks: IBlock[] = [];
  const unsupported: { line: number; message: string }[] = [];

  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const visit = (node: ts.Node, current: IBlock | undefined): void => {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, (child) => {
        visit(child, current);
      });

      return;
    }

    const base = calleeBaseName(node.expression);
    const title = staticTitle(node);

    if (base === "describe") {
      const body = callbackOf(node);

      if (body === undefined) {
        unsupported.push({
          line: lineOf(node),
          message: "`describe` has no callback, so its cases cannot be read.",
        });

        ts.forEachChild(node, (child) => {
          visit(child, current);
        });

        return;
      }

      const block: IBlock = {
        title: title ?? "<dynamic title>",
        line: lineOf(node),
        tests: 0,
        controls: 0,
      };

      blocks.push(block);
      ts.forEachChild(body, (child) => {
        visit(child, block);
      });

      return;
    }

    if ((base === "test" || base === "it") && current !== undefined) {
      /*
       * A dynamic title still counts as a case, so the suite around it still
       * owes a control. It just cannot be a control itself — a control has to
       * be recognisable as one.
       */
      current.tests += 1;

      if (title !== undefined && CONTROL_PREFIX.test(title)) {
        current.controls += 1;
      }
    }

    ts.forEachChild(node, (child) => {
      visit(child, current);
    });
  };

  ts.forEachChild(source, (child) => {
    visit(child, undefined);
  });

  return { blocks, unsupported };
}

export function checkSecuritySpecRequiresControl(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const files = collectSourceFiles(join(root, SPEC_DIR), []);

  for (const file of files) {
    if (!file.endsWith(".test.ts")) {
      continue;
    }

    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    const { blocks, unsupported } = analyse(source);

    for (const problem of unsupported) {
      violations.push({
        file,
        rule: RULE_ID,
        message: `Line ${String(problem.line)}: ${problem.message}`,
      });
    }

    if (blocks.length === 0) {
      violations.push({
        file,
        rule: RULE_ID,
        message: `${basename(file)} has no \`describe\` block, so no finding owns its cases. Wrap the cases in \`describe("<finding id> <what must hold>", …)\`.`,
      });
      continue;
    }

    for (const block of blocks) {
      if (block.tests === 0 || block.controls > 0) {
        continue;
      }

      violations.push({
        file,
        rule: RULE_ID,
        message: `Line ${String(block.line)}: \`describe("${block.title}")\` declares ${String(block.tests)} case(s) and no positive control of its own. Add a \`test("control: …")\` inside this block — a control in a parent or sibling suite does not cover this fixture.`,
      });
    }
  }

  return violations;
}

export const securitySpecRequiresControlRule: IMetaRule = {
  id: RULE_ID,
  category: "testing",
  description:
    "Every describe block in security-spec must declare its own `control:` case that passes, so an expected failure is distinguishable from a broken fixture.",
  run({ root }) {
    return checkSecuritySpecRequiresControl(root);
  },
};
