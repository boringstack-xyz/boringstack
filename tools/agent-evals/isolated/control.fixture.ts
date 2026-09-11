import { rmSync } from "node:fs";
import { join } from "node:path";
import { copyFixture } from "../../agent/generate/fixture";
import { planAccountResource } from "../../agent/generate/account-resource";
import { planReferenceUi } from "../../agent/generate/reference-ui";
import { formatEdits, formatUiEdits } from "../../agent/generate/format";
import { apply } from "../../agent/generate/patch";
import { runProcess } from "../../agent/process";

/** Build a trusted positive control for the container integration test. */
export async function prepareControl(): Promise<void> {
  const candidate = "/tmp/input/candidate";

  copyFixture("/review", candidate);
  apply(
    candidate,
    await formatEdits(
      candidate,
      planAccountResource(candidate, "Projects", "team-read-admin-write")
    )
  );
  apply(candidate, await formatUiEdits(candidate, planReferenceUi(candidate)));
  const migration = await runProcess(
    [process.execPath, "--no-env-file", "run", "db:generate"],
    { cwd: join(candidate, "apps/api") }
  );

  if (migration.status !== "completed" || migration.code !== 0) {
    throw new Error(
      `Control migration generation failed\n${migration.stderr.slice(-4000)}`
    );
  }

  for (const app of ["api", "ui"]) {
    rmSync(join(candidate, "apps", app, "node_modules"), {
      recursive: true,
      force: true,
    });
  }
}
