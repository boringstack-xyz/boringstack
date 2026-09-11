import { createRequire } from "node:module";
import { join } from "node:path";
import type { IEdit } from "./patch";

import * as prettier from "../../../apps/api/node_modules/prettier/index";

export async function formatEdits(
  root: string,
  edits: readonly IEdit[]
): Promise<IEdit[]> {
  return Promise.all(
    edits.map(async (plannedEdit) => ({
      ...plannedEdit,
      after: /\.[jt]sx?$/.test(plannedEdit.path)
        ? await prettier.format(plannedEdit.after, {
            ...(await prettier.resolveConfig(
              join(root, "apps/api/src/index.ts")
            )),
            filepath: plannedEdit.path,
          })
        : plannedEdit.after,
    }))
  );
}

export async function formatUiEdits(
  root: string,
  edits: readonly IEdit[]
): Promise<IEdit[]> {
  const requireUi = createRequire(join(root, "apps/ui/package.json"));
  const config = await prettier.resolveConfig(
    join(root, "apps/ui/src/app/router/routes.tsx")
  );
  const plugins = config?.plugins?.map((plugin) =>
    typeof plugin === "string" ? requireUi.resolve(plugin) : plugin
  );

  return Promise.all(
    edits.map(async (plannedEdit) => ({
      ...plannedEdit,
      after: await prettier.format(plannedEdit.after, {
        ...config,
        ...(plugins ? { plugins } : {}),
        filepath: plannedEdit.path,
      }),
    }))
  );
}
