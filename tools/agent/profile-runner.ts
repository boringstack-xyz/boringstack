import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ICommandCheck } from "./checks";
import { hostEnvironment } from "./environment";
import { inventoryEvidence } from "./inventory";
import { runProcess } from "./process";
import { testEvidence } from "./reports";
import type { ICheckResult, IVerificationResult } from "./result";
import { acquireLease } from "./sandbox/lease";
import { inspectSandbox, sandboxEnv, type ISandbox } from "./sandbox/lifecycle";
import { securityManifestEvidence } from "./security-evidence";
import { isAborted } from "./validation";

const NO_ENV_FILE = "--no-env-file";

export class ProfileRunner {
  state: ISandbox | undefined;

  releaseLease: (() => void) | undefined;

  private env: Record<string, string | undefined> = {
    ...hostEnvironment(),
    CI: "true",
    DOTENV_CONFIG_PATH: "/dev/null",
  };

  constructor(
    private readonly root: string,
    private readonly temp: string,
    private readonly result: IVerificationResult,
    private readonly signal?: AbortSignal,
    private readonly sandboxId?: string
  ) {}

  add(check: ICheckResult): void {
    this.result.checks.push(check);
    process.stderr.write(`${check.checkId}: ${check.status}\n`);
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

    await this.command(
      check.id,
      check.app,
      [process.execPath, NO_ENV_FILE, "run", check.script],
      check.nodeEnv !== undefined
        ? { ...this.env, NODE_ENV: check.nodeEnv }
        : this.env
    );
  }

  async tests(security: boolean): Promise<void> {
    const report = join(this.temp, security ? "security.xml" : "api.xml");
    const run = await runProcess(
      [
        process.execPath,
        NO_ENV_FILE,
        "run",
        "scripts/quality/run-tests-clean.ts",
        security ? "security-spec" : "tests",
        "--reporter=junit",
        `--reporter-outfile=${report}`,
      ],
      {
        cwd: join(this.root, "apps/api"),
        env: {
          ...this.env,
          SECURITY_SPEC: security ? "true" : "false",
          ...(security
            ? {
                ACCOUNT_DOMAIN_CLAIMING: "true",
                GOOGLE_OAUTH_CLIENT_ID: "spec-google-client-id",
                GOOGLE_OAUTH_CLIENT_SECRET: "spec-google-client-secret",
              }
            : {}),
        },
        signal: this.signal,
      }
    );
    const xml = existsSync(report) ? readFileSync(report, "utf8") : "";
    const check =
      run.status === "blocked"
        ? {
            checkId: security ? "security.tests" : "api.tests",
            status: "blocked" as const,
            reason: run.reason,
          }
        : testEvidence(
            security ? "security.tests" : "api.tests",
            xml,
            run.code,
            "bun",
            run.code === 86
          );

    this.add({
      ...(security
        ? check
        : inventoryEvidence(
            this.root,
            "api.tests",
            xml,
            check,
            this.result.checkout?.fingerprint
          )),
      durationMs: run.durationMs,
    });

    if (security) {
      this.add(
        securityManifestEvidence(this.root, xml, check.status !== "blocked")
      );
    }
  }

  async feature(featureSandbox: ISandbox, fingerprint: string): Promise<void> {
    if (isAborted(this.signal)) {
      throw new Error("interrupted");
    }

    await this.tests(false);

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
        "--reporter=junit",
        `--outputFile=${report}`,
      ],
      { cwd: join(this.root, "apps/ui"), env: this.env, signal: this.signal }
    );

    this.add(
      run.status === "blocked"
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
          )
    );

    // Full-stack adapter starts the selected checkout rather than trusting an ambient server.
    if (isAborted(this.signal)) {
      throw new Error("interrupted");
    }

    const { fullStackChecks } = await import("./runtime");

    for (const check of await fullStackChecks(
      this.root,
      featureSandbox,
      this.signal,
      fingerprint
    )) {
      this.add(check);
    }
  }

  async scripts(checks: readonly ICommandCheck[]): Promise<void> {
    for (const check of checks) {
      if (isAborted(this.signal)) {
        return;
      }

      await this.script(check);
    }
  }

  async prepareSandbox(): Promise<void> {
    if (this.sandboxId === undefined || this.sandboxId === "") {
      throw new Error("Owned sandbox required");
    }

    this.releaseLease = acquireLease(this.root, this.sandboxId);
    this.state = await inspectSandbox(this.root, this.sandboxId);
    this.env = sandboxEnv(this.state);
    this.add({
      checkId: "sandbox.ready",
      status: "passed",
      reason: "owned_services_ready",
    });
    const migration = await this.command("api.migrate", "api", [
      process.execPath,
      NO_ENV_FILE,
      "run",
      "db:migrate",
    ]);

    if (migration.status !== "passed") {
      throw new Error("Migration prerequisite failed");
    }

    const templates = await this.command("api.templates", "api", [
      process.execPath,
      NO_ENV_FILE,
      "run",
      "build:templates",
    ]);

    if (templates.status !== "passed") {
      throw new Error("Template prerequisite failed");
    }
  }
}
