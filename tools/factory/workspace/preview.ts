import type { IFactoryCommand } from "../command.types";
import { nowIso } from "../clock";
import { readEnvironment } from "../environment";
import { blocked, ok } from "../result";
import { writeRecord } from "./records";
import {
  currentPreviewSettings,
  gateStaysOn,
  refreshRoutes,
} from "./preview-routes";
import { authUrlOf, directUrlOf, previewUrlOf } from "./preview.utils";
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

    const settings = currentPreviewSettings();

    if (settings.problems.length > 0) {
      return Promise.resolve(
        blocked(
          `preview settings are not usable: ${settings.problems.join("; ")}`
        )
      );
    }

    if (
      gateStaysOn(
        runtime.shared,
        settings,
        readEnvironment().preview.authProvider
      )
    ) {
      return Promise.resolve(
        blocked(
          "the login gate is on in the proxy's variables but PREVIEW_AUTH_PROVIDER is not set here; export the PREVIEW_AUTH_* settings again, or set PREVIEW_AUTH_PROVIDER=off to turn the gate off"
        )
      );
    }

    writeRecord(runtime.shared, "preview", claim.slot, {
      slot: claim.slot,
      issue: claim.issue,
      workspace: runtime.workspace,
      url: directUrlOf(claim.slot),
      proxyUrl: previewUrlOf(claim.slot, settings),
      updatedAt: nowIso(),
    });
    const reloaded = refreshRoutes(runtime.workspace, runtime.shared);
    const proxyUrl = previewUrlOf(claim.slot, settings);
    const lines = [
      directUrlOf(claim.slot),
      `proxy ${proxyUrl} ${reloaded ? "(routes reloaded)" : "(start the proxy to use it: see infra/compose/compose/preview-proxy.yml)"}`,
    ];

    if (settings.auth !== undefined) {
      lines.push(
        `login gate on (${settings.auth.provider}): ${proxyUrl} sends you to sign in at ${authUrlOf(settings)}; the auth service must run (infra/compose/compose/preview-proxy.yml)`
      );
    }

    return Promise.resolve(
      ok(lines.join("\n"), {
        slot: claim.slot,
        url: directUrlOf(claim.slot),
        proxyUrl,
        reloaded,
      })
    );
  },
};
