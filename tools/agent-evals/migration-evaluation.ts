import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { replaceOnce } from "../agent/generate/patch";
import { runProcess } from "../agent/process";
import { judge, MIGRATION_CASES } from "./judge";

import type { IEvaluationContext } from "./evaluation.types";

const NO_ENV_FILE = "--no-env-file";
const API_DIRECTORY = "apps/api";

export async function evaluateMigration(
  context: IEvaluationContext
): Promise<void> {
  const { root, dir, evidenceDir, env, results } = context;

  const testDir = join(dir, "apps/api/tests/api/projects");

  writeFileSync(
    join(testDir, "seed.test.ts"),
    readFileSync(
      join(root, "tools/agent-evals/acceptance/seed-description.ts.template"),
      "utf8"
    )
  );
  const seed = await runProcess(
    [process.execPath, NO_ENV_FILE, "test", join(testDir, "seed.test.ts")],
    { cwd: join(dir, API_DIRECTORY), env }
  );

  if (seed.code !== 0) {
    throw new Error("Migration seed failed");
  }

  writeFileSync(
    join(testDir, "description.test.ts"),
    readFileSync(
      join(
        root,
        "tools/agent-evals/acceptance/description-migration.test.ts.template"
      ),
      "utf8"
    )
  );

  for (const migrated of [false, true]) {
    if (migrated) {
      const schemaPath = join(
        dir,
        "apps/api/src/clients/postgres/schema/projects.schema.ts"
      );

      writeFileSync(
        schemaPath,
        replaceOnce(
          readFileSync(schemaPath, "utf8"),
          "  name: varchar",
          "  description: varchar({length:2000}),\n  name: varchar"
        )
      );

      for (const script of ["db:generate", "db:migrate"]) {
        const run = await runProcess(
          [process.execPath, NO_ENV_FILE, "run", script],
          { cwd: join(dir, API_DIRECTORY), env }
        );

        if (run.code !== 0) {
          throw new Error("Description migration failed");
        }
      }
    }

    const report = join(
      evidenceDir,
      migrated ? "migration-good.xml" : "migration-missing.xml"
    );
    const run = await runProcess(
      [
        process.execPath,
        NO_ENV_FILE,
        "test",
        "tests/api/projects/description.test.ts",
        "--reporter=junit",
        `--reporter-outfile=${report}`,
      ],
      { cwd: join(dir, API_DIRECTORY), env }
    );

    results.push(
      judge(
        migrated ? "description-preserves-data" : "missing-migration",
        await Bun.file(report)
          .text()
          .catch(() => ""),
        run.code,
        MIGRATION_CASES,
        migrated ? [] : [MIGRATION_CASES[1]]
      )
    );
  }
}
