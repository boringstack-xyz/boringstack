import type { IFactoryCommand } from "../command.types";
import { nowIso } from "../clock";
import { blocked, ok } from "../result";
import { writeRecord } from "./records";
import { refreshRoutes } from "./preview-routes";
import { directUrlOf, previewUrlOf } from "./preview.utils";
import { runtimeOf, slotOfCheckout } from "./runtime";

export const previewCommand: IFactoryCommand = {
  name: "preview",
  summary: "Print (and register) this workspace's preview URL",
  run: (_args, context) => {
    const runtime = runtimeOf(context);
    const claim = slotOfCheckout(runtime.workspace);

    if (claim === undefined) {
      return Promise.resolve(
        blocked(
          "this checkout holds no slot; start one with: bun run factory workspace new <issue-id>"
        )
      );
    }

    writeRecord(runtime.shared, "preview", claim.slot, {
      slot: claim.slot,
      issue: claim.issue,
      workspace: runtime.workspace,
      url: directUrlOf(claim.slot),
      proxyUrl: previewUrlOf(claim.slot),
      updatedAt: nowIso(),
    });
    const reloaded = refreshRoutes(runtime.workspace, runtime.shared);
    const lines = [
      directUrlOf(claim.slot),
      `proxy ${previewUrlOf(claim.slot)} ${reloaded ? "(routes reloaded)" : "(start the proxy to use it: see infra/compose/compose/preview-proxy.yml)"}`,
    ];

    return Promise.resolve(
      ok(lines.join("\n"), {
        slot: claim.slot,
        url: directUrlOf(claim.slot),
        proxyUrl: previewUrlOf(claim.slot),
        reloaded,
      })
    );
  },
};
