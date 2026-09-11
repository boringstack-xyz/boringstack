import { now } from "../../../apps/api/src/lib/time/now";
import { requireValue } from "../../agent/validation";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copySource } from "../../agent/generate/fixture";
import { selectImage, type ISandbox } from "../../agent/sandbox/lifecycle";
import { docker, removeContainer } from "./docker";
import { runnerArguments } from "./policy";

export interface IIsolatedRuntime {
  name: string;
  state: ISandbox;
}

/** The controller owns Docker; candidate code has neither its socket nor a network route to it. */
export async function withIsolatedRuntime(
  root: string,
  run: (runtime: IIsolatedRuntime) => Promise<number>
): Promise<number> {
  const id = randomBytes(16).toString("hex");
  const name = `bs-candidate-${id}`;
  const image = `bs-candidate:${id}`;
  const source = mkdtempSync(join(tmpdir(), "bs-candidate-build-"));
  const state: ISandbox = {
    version: 1,
    id,
    owner: id,
    root: "/review",
    createdAt: now(),
    password: randomBytes(24).toString("hex"),
    valkeyPassword: randomBytes(24).toString("hex"),
    postgres: `${name}-pg`,
    valkey: `${name}-valkey`,
    postgresPort: 5432,
    valkeyPort: 6379,
  };
  const pins = [
    ...readFileSync(
      join(root, ".github/workflows/apps-api-ci.yml"),
      "utf8"
    ).matchAll(/^\s*image:\s*(\S+)\s*$/gm),
  ].map((match) => match[1] ?? "");

  let outcome: number | undefined;
  let failure: unknown;

  try {
    copySource(root, source);
    await docker(
      root,
      [
        "build",
        "-f",
        "tools/agent-evals/isolated/Dockerfile",
        "-t",
        image,
        source,
      ],
      900_000
    );
    await docker(root, runnerArguments(name, image));
    await docker(root, [
      "run",
      "-d",
      "--name",
      state.postgres,
      "--network",
      `container:${name}`,
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      "postgres",
      "--pids-limit",
      "128",
      "--memory",
      "1g",
      "--cpus",
      "1",
      "--tmpfs",
      "/var/lib/postgresql/data:rw,nosuid,nodev,size=512m,mode=1777",
      "--tmpfs",
      "/var/run/postgresql:rw,nosuid,nodev,mode=1777",
      "--tmpfs",
      "/tmp:rw,nosuid,nodev,size=64m,mode=1777",
      "-e",
      "PGDATA=/var/lib/postgresql/data/pgdata",
      "-e",
      "POSTGRES_USER=app",
      "-e",
      `POSTGRES_PASSWORD=${state.password}`,
      "-e",
      "POSTGRES_DB=app",
      selectImage(pins, "postgres"),
    ]);
    await docker(root, [
      "run",
      "-d",
      "--name",
      state.valkey,
      "--network",
      `container:${name}`,
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      "valkey",
      "--pids-limit",
      "64",
      "--memory",
      "256m",
      "--cpus",
      "1",
      selectImage(pins, "valkey/valkey"),
      "valkey-server",
      "--save",
      "",
      "--appendonly",
      "no",
      "--requirepass",
      state.valkeyPassword,
    ]);

    for (let attempt = 0; ; attempt++) {
      try {
        await docker(root, [
          "exec",
          "-e",
          `PGPASSWORD=${state.password}`,
          state.postgres,
          "psql",
          "-h",
          "127.0.0.1",
          "-U",
          "app",
          "-d",
          "app",
          "-c",
          "SELECT 1",
        ]);
        await docker(root, [
          "exec",
          state.valkey,
          "valkey-cli",
          "-a",
          state.valkeyPassword,
          "ping",
        ]);
        break;
      } catch {
        if (attempt >= 60) {
          throw new Error("Candidate sandbox services did not become ready");
        }

        await Bun.sleep(250);
      }
    }

    outcome = await run({ name, state });
  } catch (error) {
    failure = error;
  } finally {
    const results = await Promise.allSettled(
      [state.postgres, state.valkey, name].map((container) =>
        removeContainer(root, container)
      )
    );

    await docker(root, ["image", "rm", image]).catch(() => undefined);
    rmSync(source, { recursive: true, force: true });

    if (results.some((result) => result.status === "rejected")) {
      failure = new Error(
        `Candidate sandbox cleanup requires inspection: ${name}`,
        { cause: failure }
      );
    }
  }

  if (failure !== undefined) {
    throw failure instanceof Error
      ? failure
      : new Error("Candidate sandbox failed", { cause: failure });
  }

  return requireValue(outcome, "Candidate sandbox produced no outcome");
}
