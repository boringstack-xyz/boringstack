import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { IFactoryCommand } from "../command.types";
import { FACTORY_CONFIG } from "../factory.config";
import { blocked, ok } from "../result";
import { readJson } from "../state";
import { heldSlots } from "./claims";
import { dockerUp } from "./compose";
import { gitRun } from "./paths";
import { isSlot, slotPorts } from "./paths.utils";
import {
  bunCheck,
  composeCheck,
  freeBytesFromDf,
  freeDiskCheck,
  nodeCheck,
  requiredNode,
  type ICheck,
} from "./doctor.utils";
import { runtimeOf } from "./runtime";

/** Apps whose engines (and installed Astro) decide the Node version. */
const NODE_APPS = ["apps/docs", "apps/site"] as const;

const run = (command: string, args: readonly string[]): string | undefined => {
  const result = spawnSync(command, [...args], {
    encoding: "utf8",
    timeout: 30_000,
  });

  return result.status === 0 ? result.stdout.trim() : undefined;
};

/** Reads `engines.node` of a package.json, undefined when absent. */
const enginesNode = (file: string): string | undefined => {
  const parsed = readJson(file);
  const engines =
    typeof parsed === "object" && parsed !== null && "engines" in parsed
      ? parsed.engines
      : undefined;

  return typeof engines === "object" &&
    engines !== null &&
    "node" in engines &&
    typeof engines.node === "string"
    ? engines.node
    : undefined;
};

/** Every requirement the Node version must meet, with where it came from. */
const nodeRequirements = (
  root: string
): { ranges: string[]; sources: string[] } => {
  const ranges: string[] = [];
  const sources: string[] = [];

  for (const app of NODE_APPS) {
    const engines = enginesNode(join(root, app, "package.json"));

    if (engines !== undefined) {
      ranges.push(engines);
      sources.push(`${app} engines ${engines}`);
    }

    const astro = enginesNode(
      join(root, app, "node_modules", "astro", "package.json")
    );

    if (astro !== undefined) {
      ranges.push(astro);
      sources.push(`installed Astro in ${app} needs ${astro}`);
    }
  }

  return { ranges, sources };
};

/** Pinned bun from the root packageManager field, `bun@1.4.4` -> `1.4.4`. */
const pinnedBun = (root: string): string | undefined => {
  const parsed = readJson(join(root, "package.json"));
  const manager =
    typeof parsed === "object" && parsed !== null && "packageManager" in parsed
      ? parsed.packageManager
      : undefined;

  return typeof manager === "string"
    ? /^bun@(.+)$/u.exec(manager)?.[1]
    : undefined;
};

/** Whether anything listens on 127.0.0.1:port. */
const portInUse = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(true);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => {
        resolve(false);
      });
    });
  });

const slotPortChecks = async (shared: string): Promise<ICheck> => {
  const held = new Set(heldSlots(shared));
  const busy: string[] = [];

  for (let slot = 1; slot <= FACTORY_CONFIG.maxSlots; slot += 1) {
    if (!isSlot(slot) || held.has(slot)) {
      continue;
    }

    const ports = slotPorts(slot);

    for (const port of [ports.ui, ports.api, ports.postgres, ports.valkey]) {
      if (await portInUse(port)) {
        busy.push(String(port));
      }
    }
  }

  return busy.length === 0
    ? {
        name: "slot ports",
        ok: true,
        detail: "every port of a free slot is free",
      }
    : {
        name: "slot ports",
        ok: false,
        detail: `in use by something else: ${busy.join(", ")}`,
        fix: "stop the program using those ports (lsof -nP -iTCP:<port> shows which), then run doctor again",
      };
};

const sharedWritable = (shared: string): ICheck => {
  try {
    mkdirSync(shared, { recursive: true });
    const probe = join(shared, `.doctor-${String(process.pid)}`);

    writeFileSync(probe, "");
    rmSync(probe, { force: true });

    return { name: "shared folder", ok: true, detail: shared };
  } catch {
    return {
      name: "shared folder",
      ok: false,
      detail: `${shared} is not writable`,
      fix: "make the shared folder writable by you (or set FACTORY_SHARED_DIR to one you own)",
    };
  }
};

export const doctorCommand: IFactoryCommand = {
  name: "doctor",
  summary: "Check the machine and this workspace for what the factory needs",
  run: async (_args, context) => {
    const runtime = runtimeOf(context);
    const { ranges, sources } = nodeRequirements(runtime.main);
    const checks: ICheck[] = [];

    checks.push(
      dockerUp()
        ? { name: "docker", ok: true, detail: "the Docker daemon answers" }
        : {
            name: "docker",
            ok: false,
            detail: "the Docker daemon does not answer",
            fix: "start Docker Desktop or OrbStack, then run doctor again",
          }
    );
    checks.push(composeCheck(run("docker", ["compose", "version", "--short"])));
    checks.push(bunCheck(Bun.version, pinnedBun(runtime.main)));
    const hostNode = run("node", ["--version"])?.replace(/^v/u, "") ?? "";

    checks.push(
      ranges.length === 0
        ? {
            name: "node",
            ok: false,
            detail: "no apps/docs or apps/site package.json to read",
            fix: "run doctor from the repo",
          }
        : nodeCheck(hostNode, requiredNode(ranges), sources)
    );
    const df = run("df", ["-k", runtime.main]);

    checks.push(
      freeDiskCheck(df === undefined ? undefined : freeBytesFromDf(df))
    );
    const worktrees = gitRun(runtime.main, ["worktree", "list"]);

    checks.push(
      worktrees.ok
        ? { name: "git worktrees", ok: true, detail: "git can list worktrees" }
        : {
            name: "git worktrees",
            ok: false,
            detail: "git worktree list failed",
            fix: "update git (worktrees need git 2.5 or later)",
          }
    );
    checks.push(sharedWritable(runtime.shared));
    checks.push(await slotPortChecks(runtime.shared));

    const failedChecks = checks.filter((check) => !check.ok);
    const lines = checks.map(
      (check) => `${check.ok ? "ok  " : "FIX "} ${check.name}: ${check.detail}`
    );
    const fixes = failedChecks.map((check) => `- ${check.fix ?? check.detail}`);
    const summary = [
      ...lines,
      ...(fixes.length > 0 ? ["", "To fix:", ...fixes] : []),
    ].join("\n");

    return failedChecks.length > 0
      ? blocked(summary, { checks })
      : ok(summary, { checks });
  },
};
