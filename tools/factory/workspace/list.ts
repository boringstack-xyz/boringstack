import { existsSync } from "node:fs";

import type { IFactoryCommand } from "../command.types";
import { ok } from "../result";
import { heldSlots, readClaim } from "./claims";
import { readRecord } from "./records";
import { runtimeOf } from "./runtime";

export const listWorkspaces: IFactoryCommand = {
  name: "workspace list",
  summary: "List workspaces and the slots they hold",
  run: (_args, context) => {
    const runtime = runtimeOf(context);
    const rows = heldSlots(runtime.shared).map((slot) => {
      const claim = readClaim(runtime.shared, slot);
      const status = readRecord(runtime.shared, "status", slot);

      return {
        slot,
        issue: claim?.issue ?? "(claim unreadable)",
        path: claim?.workspace ?? "",
        folderExists: claim === undefined ? false : existsSync(claim.workspace),
        status: typeof status?.status === "string" ? status.status : "",
      };
    });
    const lines =
      rows.length === 0
        ? ["no slot is claimed"]
        : rows.map(
            (row) =>
              `slot ${String(row.slot)}  ${row.issue}  ${row.folderExists ? row.path : `${row.path} (folder missing: sweep will free it)`}${row.status === "" ? "" : `  ${row.status}`}`
          );

    return Promise.resolve(ok(lines.join("\n"), { rows }));
  },
};
