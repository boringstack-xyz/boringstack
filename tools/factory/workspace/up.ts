import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { IFactoryCommand } from "../command.types";
import { blocked, failed, ok } from "../result";
import { dockerUp, runSlotCompose } from "./compose";
import { slotOfCheckout, runtimeOf } from "./runtime";
import { stateDirOf } from "./paths";
import { slotPorts } from "./paths.utils";

const WAIT_SECONDS = 600;
const PROBE_ATTEMPTS = 60;

/** Waits until a URL answers 2xx, one probe a second. */
const answers = async (url: string): Promise<boolean> => {
  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });

      if (response.ok) {
        return true;
      }
    } catch {
      // not up yet
    }

    await Bun.sleep(1000);
  }

  return false;
};

export const upStack: IFactoryCommand = {
  name: "up",
  summary: "Build and start this workspace's stack, wait for health, seed",
  run: async (_args, context) => {
    const runtime = runtimeOf(context);
    const claim = slotOfCheckout(runtime.workspace);

    if (claim === undefined) {
      return blocked(
        "this checkout holds no slot; start one with: bun run factory workspace new <issue-id>"
      );
    }

    if (!dockerUp()) {
      return blocked("Docker is not running; start Docker, then run up again");
    }

    const stateDir = stateDirOf(runtime.workspace);

    mkdirSync(stateDir, { recursive: true });
    const log = join(stateDir, "up.log");
    const ports = slotPorts(claim.slot);
    const started = runSlotCompose(
      runtime.workspace,
      stateDir,
      claim.slot,
      [
        "up",
        "-d",
        "--build",
        "--remove-orphans",
        "--wait",
        "--wait-timeout",
        String(WAIT_SECONDS),
      ],
      log,
      (WAIT_SECONDS + 300) * 1000
    );

    if (started.error !== undefined || started.code !== 0) {
      return failed(
        `the stack did not become healthy (build output and errors: ${log}); see the last lines there`,
        { log, code: started.code }
      );
    }

    const ui = await answers(`http://127.0.0.1:${String(ports.ui)}/`);
    const api = await answers(`http://127.0.0.1:${String(ports.api)}/health`);

    if (!ui || !api) {
      const missing = [
        !ui ? "the app" : undefined,
        !api ? "the API" : undefined,
      ]
        .filter((name): name is string => name !== undefined)
        .join(" and ");

      return failed(
        `${missing} did not answer on 127.0.0.1 after start (details: ${log})`,
        { ui, api }
      );
    }

    return ok(
      [
        `slot ${String(claim.slot)} is healthy`,
        `UI  http://127.0.0.1:${String(ports.ui)}`,
        `API http://127.0.0.1:${String(ports.api)}/health`,
      ].join("\n"),
      { slot: claim.slot, ports, log }
    );
  },
};
