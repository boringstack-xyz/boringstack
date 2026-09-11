import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { now } from "../../../apps/api/src/lib/time/now";
import { hostEnvironment } from "../environment";
import { runProcess } from "../process";
import { errorHasCode, parseRecord } from "../validation";

export interface ISandbox {
  version: 1;
  id: string;
  owner: string;
  root: string;
  createdAt: string;
  password: string;
  valkeyPassword: string;
  postgres: string;
  valkey: string;
  postgresPort: number;
  valkeyPort: number;
}
const VALKEY_PONG = "PONG";
const ID = /^[a-f0-9]{32}$/;
const ownerOf = (root: string): string =>
  createHash("sha256").update(realpathSync(root)).digest("hex");
const stateDir = (root: string): string =>
  join(root, ".agent-state", "sandboxes");

function safeState(root: string): void {
  for (const path of [join(root, ".agent-state"), stateDir(root)]) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
      throw new Error("Sandbox state cannot be a symlink");
    }

    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
}

async function docker(root: string, args: string[]): Promise<string> {
  const result = await runProcess(["docker", ...args], {
    cwd: root,
    timeoutMs: 120_000,
  });

  if (result.status !== "completed" || result.code !== 0) {
    throw new Error("Docker operation failed; inspect the local runtime");
  }

  return result.stdout.trim();
}

function image(root: string, service: string): string {
  const workflow = readFileSync(
    join(root, ".github/workflows/apps-api-ci.yml"),
    "utf8"
  );
  const pins = [...workflow.matchAll(/^\s*image:\s*(\S+)\s*$/gm)].map(
    (match) => match[1] ?? ""
  );

  return selectImage(pins, service);
}

export function selectImage(pins: string[], service: string): string {
  if (service !== "postgres" && service !== "valkey/valkey") {
    throw new Error("Unsupported image");
  }

  const matching = pins.filter((pin) => pin.startsWith(`${service}:`));

  const selected = matching[0];

  if (
    matching.length !== 1 ||
    selected === undefined ||
    !/^(postgres|valkey\/valkey):[^/@\s:]+@sha256:[a-f0-9]{64}$/.test(selected)
  ) {
    throw new Error("Pinned test service image missing or invalid");
  }

  return selected;
}

function save(root: string, state: ISandbox): void {
  safeState(root);
  writeFileSync(
    join(stateDir(root), `${state.id}.json`),
    JSON.stringify(state),
    { mode: 0o600 }
  );
}

export function readSandbox(root: string, id: string): ISandbox {
  if (!ID.test(id)) {
    throw new Error("Invalid sandbox ID");
  }

  safeState(root);
  const path = join(stateDir(root), `${id}.json`);

  if (lstatSync(path).isSymbolicLink()) {
    throw new Error("Sandbox descriptor cannot be a symlink");
  }

  const value = parseRecord(readFileSync(path, "utf8"));

  if (
    value.version !== 1 ||
    value.id !== id ||
    value.owner !== ownerOf(root) ||
    value.root !== realpathSync(root) ||
    typeof value.createdAt !== "string" ||
    typeof value.password !== "string" ||
    typeof value.valkeyPassword !== "string" ||
    typeof value.postgres !== "string" ||
    typeof value.valkey !== "string" ||
    typeof value.postgresPort !== "number" ||
    typeof value.valkeyPort !== "number" ||
    !/^[a-f0-9]{48}$/.test(value.password) ||
    !/^[a-f0-9]{48}$/.test(value.valkeyPassword)
  ) {
    throw new Error("Invalid sandbox descriptor or ownership mismatch");
  }

  const sandbox: ISandbox = {
    version: 1,
    id,
    owner: value.owner,
    root: value.root,
    createdAt: value.createdAt,
    password: value.password,
    valkeyPassword: value.valkeyPassword,
    postgres: value.postgres,
    valkey: value.valkey,
    postgresPort: value.postgresPort,
    valkeyPort: value.valkeyPort,
  };

  for (const cid of [sandbox.postgres, sandbox.valkey]) {
    if (cid !== "" && !/^[a-f0-9]{64}$/.test(cid)) {
      throw new Error("Invalid container ID");
    }
  }

  return sandbox;
}

async function owned(
  root: string,
  state: ISandbox,
  cid: string
): Promise<void> {
  const labels = await docker(root, [
    "inspect",
    "--format",
    "{{json .Config.Labels}}",
    cid,
  ]);
  const value = parseRecord(labels);

  if (
    value["xyz.boringstack.agent.owner"] !== state.owner ||
    value["xyz.boringstack.agent.sandbox"] !== state.id
  ) {
    throw new Error("Container ownership mismatch");
  }
}

async function port(
  root: string,
  cid: string,
  containerPort: number
): Promise<number> {
  const binding = await docker(root, ["port", cid, `${containerPort}/tcp`]);
  const match = /^127\.0\.0\.1:(\d+)$/.exec(binding);

  if (match?.[1] === undefined) {
    throw new Error("Sandbox must bind exclusively to loopback");
  }

  return Number(match[1]);
}

export async function inspectSandbox(
  root: string,
  id: string
): Promise<ISandbox> {
  const state = readSandbox(root, id);

  for (const cid of [state.postgres, state.valkey]) {
    await owned(root, state, cid);
  }

  state.postgresPort = await port(root, state.postgres, 5432);
  state.valkeyPort = await port(root, state.valkey, 6379);
  await docker(root, [
    "exec",
    state.postgres,
    "pg_isready",
    "-h",
    "127.0.0.1",
    "-U",
    "app",
    "-d",
    "app",
  ]);
  const pong = await docker(root, [
    "exec",
    "-e",
    `REDISCLI_AUTH=${state.valkeyPassword}`,
    state.valkey,
    "valkey-cli",
    "ping",
  ]);

  if (pong !== VALKEY_PONG) {
    throw new Error("Valkey unavailable");
  }

  return state;
}

export async function downSandbox(root: string, id: string): Promise<void> {
  const state = readSandbox(root, id);
  const lock = join(stateDir(root), `${id}.lock`);

  if (existsSync(lock)) {
    const pid: unknown = parseRecord(readFileSync(lock, "utf8")).pid;

    if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid < 1) {
      throw new Error("Invalid lease");
    }

    let alive = true;

    try {
      process.kill(pid, 0);
    } catch (error) {
      if (errorHasCode(error, "ESRCH")) {
        alive = false;
      } else {
        throw error;
      }
    }

    if (alive) {
      throw new Error("Sandbox is in use");
    }

    rmSync(lock);
  }

  // Resolve all owned resources, including a container created just before a crash interrupted persistence.
  const found = await docker(root, [
    "ps",
    "-aq",
    "--no-trunc",
    "--filter",
    `label=xyz.boringstack.agent.owner=${state.owner}`,
    "--filter",
    `label=xyz.boringstack.agent.sandbox=${state.id}`,
  ]);

  for (const cid of found.split("\n").filter(Boolean)) {
    await owned(root, state, cid);
    await docker(root, ["rm", "-f", "-v", cid]);
  }

  rmSync(join(stateDir(root), `${id}.json`));
}

export async function upSandbox(root: string): Promise<ISandbox> {
  const state: ISandbox = {
    version: 1,
    id: randomUUID().replaceAll("-", ""),
    owner: ownerOf(root),
    root: realpathSync(root),
    createdAt: now(),
    password: randomBytes(24).toString("hex"),
    valkeyPassword: randomBytes(24).toString("hex"),
    postgres: "",
    valkey: "",
    postgresPort: 0,
    valkeyPort: 0,
  };

  save(root, state);

  try {
    const labels = [
      "--label",
      `xyz.boringstack.agent.owner=${state.owner}`,
      "--label",
      `xyz.boringstack.agent.sandbox=${state.id}`,
    ];

    state.postgres = await docker(root, [
      "run",
      "-d",
      ...labels,
      "--name",
      `bs-agent-${state.id}-pg`,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_USER=app",
      "-e",
      "POSTGRES_DB=app",
      "-e",
      `POSTGRES_PASSWORD=${state.password}`,
      image(root, "postgres"),
    ]);
    save(root, state);
    state.valkey = await docker(root, [
      "run",
      "-d",
      ...labels,
      "--name",
      `bs-agent-${state.id}-valkey`,
      "-p",
      "127.0.0.1::6379",
      image(root, "valkey/valkey"),
      "valkey-server",
      "--requirepass",
      state.valkeyPassword,
    ]);
    save(root, state);

    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const ready = await inspectSandbox(root, state.id);

        save(root, ready);

        return ready;
      } catch {
        await Bun.sleep(500);
      }
    }

    throw new Error("Sandbox services did not become ready");
  } catch (error) {
    try {
      await downSandbox(root, state.id);
    } catch {
      /* Descriptor remains for explicitly scoped recovery. */
    }

    throw error;
  }
}

/** Explicit test defaults override Bun's ambient dotenv. No developer service credentials are inherited. */
export function sandboxEnv(state: ISandbox): Record<string, string> {
  const db = `postgresql://app:${state.password}@127.0.0.1:${state.postgresPort}/app`;

  return {
    AGENT_SANDBOX: "1",
    ...(hostEnvironment().PLAYWRIGHT_BROWSERS_PATH === undefined
      ? {}
      : {
          PLAYWRIGHT_BROWSERS_PATH:
            hostEnvironment().PLAYWRIGHT_BROWSERS_PATH ?? "",
        }),
    PATH: hostEnvironment().PATH ?? "",
    HOME: hostEnvironment().HOME ?? "",
    NODE_ENV: "test",
    CI: "true",
    DOTENV_CONFIG_PATH: "/dev/null",
    DATABASE_URL: db,
    TEST_DATABASE_URL: db,
    REQUIRE_INTEGRATION_DB: "true",
    RUN_VALKEY_NETWORK_TESTS: "true",
    VALKEY_HOST: "127.0.0.1",
    VALKEY_PORT: String(state.valkeyPort),
    VALKEY_PASSWORD: state.valkeyPassword,
    CACHE_PROVIDER: "valkey",
    CACHE_ENABLED: "true",
    JWT_SECRET: "agent-verification-test-secret-not-for-production",
    MFA_ENCRYPTION_KEY: Buffer.from(
      "0123456789abcdef0123456789abcdef"
    ).toString("base64"),
    ACCOUNT_DOMAIN_CLAIMING: "false",
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1",
    EMAIL_FROM: "test@example.com",
    AUTH_RATE_LIMIT_MAX: "1000000",
    RATE_LIMIT_MAX: "1000000",
    LOG_LEVEL: "error",
    BILLING_ENABLED: "true",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    OTEL_ENABLED: "false",
    SENTRY_DSN: "",
    AI_ENABLED: "false",
    FRONTEND_URL: "http://localhost:7331",
    PUBLIC_API_URL: "http://localhost:7330",
    ALLOWED_ORIGINS: "http://localhost:7331",
  };
}

export function publicSandbox(state: ISandbox): object {
  return {
    schemaVersion: 1,
    id: state.id,
    createdAt: state.createdAt,
    postgresPort: state.postgresPort,
    valkeyPort: state.valkeyPort,
    ownership: "current-checkout",
  };
}
