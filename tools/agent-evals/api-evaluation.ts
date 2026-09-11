import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { replaceOnce } from "../agent/generate/patch";
import { runProcess } from "../agent/process";
import { API_CASES, judge } from "./judge";
import { withoutRecordAccountPredicate } from "./mutants";

import type { IEvaluationContext } from "./evaluation.types";

const NO_ENV_FILE = "--no-env-file";
const API_DIRECTORY = "apps/api";

function mutateRoutes(goodRoutes: string, variantId: string): string {
  let routes = goodRoutes;

  if (variantId === "client-selector") {
    routes = replaceOnce(
      routes,
      "({ user, accountId }) => projectsService.list(user.id, accountId)",
      '({ user, accountId, headers }) => projectsService.list(user.id, headers["x-account-id"] ?? accountId)'
    );
  }

  if (variantId === "client-selector-create") {
    routes = replaceOnce(
      replaceOnce(
        routes,
        "({ user, accountId, body }) =>",
        "({ user, accountId, body, headers }) =>"
      ),
      "projectsService.create(user.id, accountId, body.name)",
      'projectsService.create(user.id, headers["x-account-id"] ?? accountId, body.name)'
    );
  }

  if (variantId === "extra-delete") {
    routes = replaceOnce(
      routes,
      "const projectsRoutes = requireAuth()",
      'const projectsRoutes = requireAuth().delete("/:id", ({user,accountId,params}) => projectsService.get(user.id,accountId,params.id))'
    );
  }

  return routes;
}

export async function evaluateApi(context: IEvaluationContext): Promise<void> {
  const { root, dir, evidenceDir, candidate, env, results } = context;
  /*
   * The judge is copied from the reviewing checkout after the candidate is prepared.
   * Candidate tests, manifest expectations and verifier scripts are never executed as evidence.
   */
  const judgeSource = readFileSync(
    join(
      root,
      "tools/agent-evals/acceptance/account-resource.test.ts.template"
    ),
    "utf8"
  );
  const judgePath = join(
    dir,
    "apps/api/tests/api/projects/projects.routes.test.ts"
  );

  writeFileSync(judgePath, judgeSource);
  const service = join(dir, "apps/api/src/api/projects/projects.service.ts");
  const good = readFileSync(service, "utf8");
  const routePath = join(dir, "apps/api/src/api/projects/projects.routes.ts");
  const goodRoutes = readFileSync(routePath, "utf8");
  const variants =
    candidate !== undefined
      ? [{ id: "submission", source: good, expected: "passed" }]
      : [
          { id: "known-good", source: good, expected: "passed" },
          {
            id: "missing-scope",
            source: replaceOnce(
              good,
              ".where(eq(projects.accountId, accountId))",
              ""
            ),
            expected: "failed",
          },
          {
            id: "missing-role",
            source: replaceOnce(
              good,
              /requireAbility\([\s\S]*?\);/.exec(good)?.[0] ??
                "MISSING_AUTH_ANCHOR",
              ""
            ),
            expected: "failed",
          },
        ];

  if (candidate === undefined) {
    variants.push(
      {
        id: "missing-get-scope",
        source: withoutRecordAccountPredicate(good, 0),
        expected: "failed",
      },
      {
        id: "missing-rename-scope",
        source: withoutRecordAccountPredicate(good, 1),
        expected: "failed",
      },
      { id: "client-selector", source: good, expected: "failed" },
      { id: "client-selector-create", source: good, expected: "failed" },
      { id: "extra-delete", source: good, expected: "failed" }
    );
  }

  for (const variant of variants) {
    const routes = mutateRoutes(goodRoutes, variant.id);

    writeFileSync(routePath, routes);
    writeFileSync(service, variant.source);
    const report = join(evidenceDir, `${variant.id}.xml`);
    const run = await runProcess(
      [
        process.execPath,
        NO_ENV_FILE,
        "test",
        "tests/api/projects/projects.routes.test.ts",
        "tests/api/projects/projects.service.test.ts",
        "--reporter=junit",
        `--reporter-outfile=${report}`,
      ],
      { cwd: join(dir, API_DIRECTORY), env }
    );
    const check = judge(
      variant.id,
      await Bun.file(report)
        .text()
        .catch(() => ""),
      run.code,
      API_CASES,
      ["missing-scope", "missing-get-scope", "missing-rename-scope"].includes(
        variant.id
      )
        ? [API_CASES[1], API_CASES[8]]
        : variant.id === "client-selector" ||
            variant.id === "client-selector-create"
          ? [API_CASES[8]]
          : variant.id === "extra-delete"
            ? [API_CASES[9]]
            : variant.id === "missing-role"
              ? [API_CASES[2], API_CASES[3]]
              : []
    );

    results.push(check);
    process.stderr.write(`${variant.id}: ${check.status}\n`);
  }

  writeFileSync(service, good);
  writeFileSync(routePath, goodRoutes);
}
