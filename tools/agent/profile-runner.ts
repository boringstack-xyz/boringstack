import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { type ICommandCheck } from "./checks";
import type { ITask } from "./scheduler";
import type { IExecutionBudget } from "./scheduling";
import { mergeJunitReports, shardFiles, suiteDurations } from "./junit";
import { hostEnvironment } from "./environment";
import { inventoryEvidence } from "./inventory";
import { runProcess, type IProcessResult } from "./process";
import { testEvidence } from "./reports";
import type { ICheckResult, IVerificationResult } from "./result";
import { acquireLease } from "./sandbox/lease";
import {
  ensureLaneDatabases,
  inspectSandbox,
  SANDBOX_LANES,
  sandboxEnv,
  securityShardLane,
  type ISandbox,
  type ISandboxLane,
} from "./sandbox/lifecycle";
import { securityManifestEvidence } from "./security-evidence";
import { isAborted, isRecord, parseRecord } from "./validation";

const NO_ENV_FILE = "--no-env-file";

export class ProfileRunner {
  state: ISandbox | undefined;

  releaseLease: (() => void) | undefined;

  private readonly env: Record<string, string | undefined> = {
    ...hostEnvironment(),
    CI: "true",
    DOTENV_CONFIG_PATH: "/dev/null",
  };

  constructor(
    private readonly root: string,
    private readonly temp: string,
    private readonly result: IVerificationResult,
    private readonly signal?: AbortSignal,
    private readonly sandboxId?: string,
    readonly budget: IExecutionBudget = {
      slots: 1,
      testWorkers: 1,
      uiTestWorkers: 1,
      securityShards: 1,
    }
  ) {}

  /** Shard reports collected for the aggregate security evidence. */
  private readonly securityReports = new Map<
    number,
    { xml: string; run: IProcessResult }
  >();

  /** Environment for a stateful lane: its own database and Valkey index. */
  laneEnv(lane: ISandboxLane): Record<string, string | undefined> {
    if (this.state === undefined) {
      throw new Error("Sandbox absent");
    }

    return sandboxEnv(this.state, lane);
  }

  add(check: ICheckResult): void {
    this.result.checks.push(check);
    process.stderr.write(`${check.checkId}: ${check.status}\n`);
  }

  private logFailure(id: string, run: IProcessResult): void {
    const directory = join(
      this.root,
      ".agent-state",
      "verification",
      this.result.runId
    );

    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(
      directory,
      `${id.replaceAll(/[^a-zA-Z0-9.-]/g, "_")}.log`
    );

    writeFileSync(path, run.stdout + run.stderr, { mode: 0o600 });
    process.stderr.write(`${id}: output saved to ${path}\n`);
  }

  async command(
    id: string,
    app: string,
    argv: string[],
    commandEnv = this.env
  ): Promise<ICheckResult> {
    const run = await runProcess(argv, {
      cwd: app === "root" ? this.root : join(this.root, "apps", app),
      env: commandEnv,
      signal: this.signal,
    });
    const check: ICheckResult = {
      checkId: id,
      status:
        run.status === "blocked"
          ? "blocked"
          : run.code === 0
            ? "passed"
            : "failed",
      reason:
        run.status === "blocked"
          ? run.reason
          : run.code === 0
            ? "command_passed"
            : "command_failed",
      durationMs: run.durationMs,
    };

    this.add(check);

    if (check.status !== "passed") {
      this.logFailure(id, run);
    }

    return check;
  }

  async script(check: ICommandCheck): Promise<void> {
    if (check.app === "docs" && !existsSync(join(this.root, "apps/docs"))) {
      this.add({
        checkId: check.id,
        status: "not_applicable",
        reason: "template_docs_not_present",
      });

      return;
    }

    const base =
      check.lane === undefined
        ? this.env
        : this.laneEnv(SANDBOX_LANES[check.lane]);

    await this.command(
      check.id,
      check.app,
      [process.execPath, NO_ENV_FILE, "run", check.script],
      check.nodeEnv !== undefined ? { ...base, NODE_ENV: check.nodeEnv } : base
    );
  }

  private securityEnv(lane: ISandboxLane): Record<string, string | undefined> {
    return {
      ...this.laneEnv(lane),
      SECURITY_SPEC: "true",
      ACCOUNT_DOMAIN_CLAIMING: "true",
      GOOGLE_OAUTH_CLIENT_ID: "spec-google-client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "spec-google-client-secret",
    };
  }

  private async bunTests(
    argv: readonly string[],
    report: string,
    env: Record<string, string | undefined>
  ): Promise<{ run: IProcessResult; xml: string }> {
    const run = await runProcess(
      [
        process.execPath,
        NO_ENV_FILE,
        "run",
        ...argv,
        "--reporter=junit",
        `--reporter-outfile=${report}`,
      ],
      { cwd: join(this.root, "apps/api"), env, signal: this.signal }
    );

    return {
      run,
      xml: existsSync(report) ? readFileSync(report, "utf8") : "",
    };
  }

  /** API tests on the `tests` lane; in release runs the same execution enforces coverage. */
  async apiTests(coverage = false): Promise<void> {
    const { run, xml } = await this.bunTests(
      coverage
        ? ["scripts/quality/check-coverage.ts"]
        : ["scripts/quality/run-tests-clean.ts", "tests"],
      join(this.temp, "api.xml"),
      { ...this.laneEnv(SANDBOX_LANES.tests), SECURITY_SPEC: "false" }
    );
    const check =
      run.status === "blocked"
        ? {
            checkId: "api.tests",
            status: "blocked" as const,
            reason: run.reason,
          }
        : testEvidence("api.tests", xml, run.code, "bun", run.code === 86);
    const evidence = inventoryEvidence(
      this.root,
      "api.tests",
      xml,
      check,
      this.result.checkout?.fingerprint
    );

    this.add({ ...evidence, durationMs: run.durationMs });

    if (evidence.status !== "passed") {
      this.logFailure("api.tests", run);
    }

    if (coverage) {
      this.add({
        checkId: "api.coverage",
        status: evidence.status,
        reason:
          evidence.status === "passed"
            ? "coverage_gate_passed"
            : evidence.reason,
        durationMs: run.durationMs,
      });
    }
  }

  private timingsPath(): string {
    return join(
      this.root,
      ".agent-state",
      "verification",
      "timings",
      "security-spec.json"
    );
  }

  /** Per-file seconds recorded by the previous run; empty on a fresh checkout. */
  recordedDurations(): Record<string, number> {
    const path = this.timingsPath();

    if (!existsSync(path)) {
      return {};
    }

    try {
      const value = parseRecord(readFileSync(path, "utf8")).files;

      return isRecord(value)
        ? Object.fromEntries(
            Object.entries(value).filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === "number" && Number.isFinite(entry[1])
            )
          )
        : {};
    } catch {
      return {};
    }
  }

  private recordDurations(xml: string): void {
    const files = suiteDurations(xml);

    if (Object.keys(files).length === 0) {
      return;
    }

    mkdirSync(join(this.timingsPath(), ".."), { recursive: true, mode: 0o700 });
    writeFileSync(
      this.timingsPath(),
      JSON.stringify({ schemaVersion: 1, files }, null, 2),
      { mode: 0o600 }
    );
  }

  /**
   * Spec files packed into `count` shards, longest first. Duration comes from
   * the previous run's JUnit report; a file without a record is assumed to be
   * as long as the median recorded file, and size decides ties, so a fresh
   * checkout still gets a sensible split.
   */
  securityShardFiles(count: number): string[][] {
    const directory = join(this.root, "apps/api/security-spec");
    const recorded = this.recordedDurations();
    const known = Object.values(recorded).sort((left, right) => left - right);
    const median = known[Math.floor(known.length / 2)] ?? 1;
    const files = readdirSync(directory)
      .filter((name) => name.endsWith(".test.ts"))
      .map((name) => {
        const path = `security-spec/${name}`;
        const size = statSync(join(directory, name)).size;

        return {
          path,
          // Seconds dominate; bytes only order files of equal duration.
          size: (recorded[path] ?? median) * 1_000_000 + size,
        };
      });

    return shardFiles(files, count);
  }

  /**
   * One shard of the security spec on its own lane. With a single shard this
   * is the whole spec and records the `security.tests` evidence directly.
   */
  async securityShard(
    index: number,
    count: number,
    files: readonly string[]
  ): Promise<void> {
    const lane = securityShardLane(index, count);
    const { run, xml } = await this.bunTests(
      ["scripts/quality/run-tests-clean.ts", ...files],
      join(this.temp, `security-${String(index)}.xml`),
      this.securityEnv(lane)
    );

    this.securityReports.set(index, { xml, run });

    if (count === 1) {
      this.securityEvidence([run], xml);

      return;
    }

    const checkId = `security.tests.${String(index)}`;
    const check =
      run.status === "blocked"
        ? { checkId, status: "blocked" as const, reason: run.reason }
        : testEvidence(checkId, xml, run.code, "bun", run.code === 86);

    this.add({ ...check, durationMs: run.durationMs });

    if (check.status !== "passed") {
      this.logFailure(checkId, run);
    }
  }

  /** Merges the shard reports so evidence and the manifest see one run. */
  securityAggregate(count: number): void {
    const shards = Array.from({ length: count }, (_, offset) =>
      this.securityReports.get(offset + 1)
    );

    if (shards.includes(undefined)) {
      this.add({
        checkId: "security.tests",
        status: "blocked",
        reason: "security_shard_missing",
      });
      this.add({
        checkId: "security.manifest",
        status: "blocked",
        reason: "security_shard_missing",
      });

      return;
    }

    const present = shards.flatMap((shard) =>
      shard === undefined ? [] : [shard]
    );

    this.securityEvidence(
      present.map((shard) => shard.run),
      mergeJunitReports(present.map((shard) => shard.xml))
    );
  }

  private securityEvidence(runs: readonly IProcessResult[], xml: string): void {
    const blocked = runs.find((run) => run.status === "blocked");
    const exit = runs.reduce<number | null>(
      (worst, run) =>
        worst === null || run.code === null ? null : Math.max(worst, run.code),
      0
    );
    const check =
      blocked !== undefined
        ? {
            checkId: "security.tests",
            status: "blocked" as const,
            reason: blocked.reason,
          }
        : testEvidence(
            "security.tests",
            xml,
            exit,
            "bun",
            runs.some((run) => run.code === 86)
          );
    const durationMs = runs.reduce((total, run) => total + run.durationMs, 0);

    this.add({ ...check, durationMs });
    this.recordDurations(xml);

    if (check.status !== "passed") {
      for (const run of runs) {
        this.logFailure("security.tests", run);
      }
    }

    this.add(
      securityManifestEvidence(this.root, xml, check.status !== "blocked")
    );
  }

  async uiTests(fingerprint: string): Promise<void> {
    if (isAborted(this.signal)) {
      throw new Error("interrupted");
    }

    // Vitest's own coverage gate remains authoritative; a separate JUnit report establishes execution.
    const report = join(this.temp, "ui.xml");
    const run = await runProcess(
      [
        process.execPath,
        NO_ENV_FILE,
        "run",
        "scripts/quality/run-tests-clean.ts",
        "run",
        "--coverage",
        "--coverage.reporter=text-summary",
        "--coverage.reporter=lcovonly",
        `--maxWorkers=${String(this.budget.uiTestWorkers)}`,
        "--reporter=junit",
        `--outputFile=${report}`,
      ],
      { cwd: join(this.root, "apps/ui"), env: this.env, signal: this.signal }
    );

    this.add({
      durationMs: run.durationMs,
      ...(run.status === "blocked"
        ? { checkId: "ui.tests", status: "blocked", reason: run.reason }
        : inventoryEvidence(
            this.root,
            "ui.tests",
            existsSync(report) ? readFileSync(report, "utf8") : "",
            testEvidence(
              "ui.tests",
              existsSync(report) ? readFileSync(report, "utf8") : "",
              run.code,
              "bun",
              run.code === 86
            ),
            fingerprint
          )),
    });

    if (
      this.result.checks.find((check) => check.checkId === "ui.tests")
        ?.status !== "passed"
    ) {
      this.logFailure("ui.tests", run);
    }
  }

  /** Full-stack adapter starts the selected checkout rather than trusting an ambient server. */
  async e2e(featureSandbox: ISandbox, fingerprint: string): Promise<void> {
    if (isAborted(this.signal)) {
      throw new Error("interrupted");
    }

    const { fullStackChecks } = await import("./runtime");

    for (const check of await fullStackChecks(
      this.root,
      featureSandbox,
      this.signal,
      fingerprint,
      SANDBOX_LANES.e2e,
      this.budget.testWorkers
    )) {
      this.add(check);
    }
  }

  /** Tasks declare their evidence IDs so concurrent completions cannot cross-contaminate status. */
  task(
    id: string,
    run: () => Promise<void>,
    after: readonly string[] = [],
    slots = 1,
    priority = 0,
    evidenceIds: readonly string[] = [id]
  ): ITask {
    return {
      id,
      after,
      slots,
      priority,
      run: async () => {
        await run();

        return evidenceIds.every((checkId) =>
          this.result.checks.some(
            (check) =>
              check.checkId === checkId &&
              (check.status === "passed" || check.status === "not_applicable")
          )
        );
      },
      blocked: (reason) => {
        for (const checkId of evidenceIds) {
          if (!this.result.checks.some((check) => check.checkId === checkId)) {
            this.add({ checkId, status: "blocked", reason });
          }
        }
      },
    };
  }

  scriptTasks(checks: readonly ICommandCheck[]): ITask[] {
    return checks.map((check) =>
      this.task(
        check.id,
        () => this.script(check),
        [
          ...(check.after === undefined ? [] : [check.after]),
          ...(check.id === "api.build" ? ["api.templates"] : []),
        ],
        1,
        check.priority
      )
    );
  }

  async prepareSandbox(lanes: readonly ISandboxLane[]): Promise<void> {
    if (this.sandboxId === undefined || this.sandboxId === "") {
      throw new Error("Owned sandbox required");
    }

    this.releaseLease = acquireLease(this.root, this.sandboxId);
    this.state = await inspectSandbox(this.root, this.sandboxId);
    await ensureLaneDatabases(this.root, this.state, lanes);
    this.add({
      checkId: "sandbox.ready",
      status: "passed",
      reason: "owned_services_ready",
    });
  }

  async migrate(lane: ISandboxLane): Promise<void> {
    await this.command(
      `api.migrate.${lane.name}`,
      "api",
      [process.execPath, NO_ENV_FILE, "run", "db:prepare"],
      this.laneEnv(lane)
    );
  }

  async templates(): Promise<void> {
    await this.command("api.templates", "api", [
      process.execPath,
      NO_ENV_FILE,
      "run",
      "build:templates",
    ]);
  }
}
