import { existsSync, readFileSync } from "node:fs";
import { runEvaluation } from "../evaluation-runner";
import type { ISandbox } from "../../agent/sandbox/lifecycle";
import { parseRecord } from "../../agent/validation";

if (
  !existsSync("/.dockerenv") ||
  process.getuid?.() !== 1000 ||
  existsSync("/var/run/docker.sock")
) {
  throw new Error(
    "This worker must run through the isolated candidate controller"
  );
}

const descriptor = parseRecord(readFileSync("/tmp/input/sandbox.json", "utf8"));

if (
  typeof descriptor.password !== "string" ||
  typeof descriptor.valkeyPassword !== "string" ||
  typeof descriptor.id !== "string"
) {
  throw new Error("Invalid isolated service descriptor");
}

const state: ISandbox = {
  version: 1,
  id: descriptor.id,
  owner: descriptor.id,
  root: "/review",
  createdAt: "isolated",
  password: descriptor.password,
  valkeyPassword: descriptor.valkeyPassword,
  postgres: "isolated-postgres",
  valkey: "isolated-valkey",
  postgresPort: 5432,
  valkeyPort: 6379,
};

process.exitCode = await runEvaluation(
  "/review",
  "/tmp/input/candidate",
  state
);
