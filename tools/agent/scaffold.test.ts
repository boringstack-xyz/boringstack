import { expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process";

/** Exercise script routing without generating code or contacting a developer's API. */
test("regeneration supports both documentation and stripped product checkouts", async () => {
  const source = fileURLToPath(new URL("../../", import.meta.url));
  const root = mkdtempSync(join(tmpdir(), "bs-stripped-"));

  try {
    for (const directory of ["scripts", "apps/api", "apps/ui", "bin"]) {
      mkdirSync(join(root, directory), { recursive: true });
    }

    for (const script of ["stack-regen.sh", "stack-lib.sh"]) {
      copyFileSync(
        join(source, "scripts", script),
        join(root, "scripts", script)
      );
    }

    const log = join(root, "commands");

    writeFileSync(
      join(root, "bin/bun"),
      '#!/bin/sh\nprintf "%s:%s\\n" "$PWD" "$*" >> "$COMMAND_LOG"\n'
    );
    writeFileSync(join(root, "bin/curl"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(root, "bin/bun"), 0o755);
    chmodSync(join(root, "bin/curl"), 0o755);

    for (const docsPresent of [false, true]) {
      if (docsPresent) {
        mkdirSync(join(root, "apps/docs"));
      }

      writeFileSync(log, "");
      const result = await runProcess(["/bin/bash", "scripts/stack-regen.sh"], {
        cwd: root,
        env: { PATH: `${join(root, "bin")}:/usr/bin:/bin`, COMMAND_LOG: log },
        timeoutMs: 10_000,
      });

      expect(result.code).toBe(0);
      const commands = readFileSync(log, "utf8");

      expect(commands).toContain("apps/api:run generate:acl-types");
      expect(commands).toContain("apps/ui:run generate:lint-meta-docs");
      expect(commands.includes("apps/docs:run generate:docs-data")).toBe(
        docsPresent
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rename replaces template onboarding and preserves product edits on rerun", async () => {
  const source = fileURLToPath(new URL("../../", import.meta.url));
  const root = mkdtempSync(join(tmpdir(), "bs-product-"));

  try {
    mkdirSync(join(root, "scripts"));
    copyFileSync(
      join(source, "scripts/rename-project.sh"),
      join(root, "scripts/rename-project.sh")
    );
    copyFileSync(join(source, "README.md"), join(root, "README.md"));
    copyFileSync(join(source, "AGENTS.md"), join(root, "AGENTS.md"));
    const command = [
      "/bin/bash",
      "scripts/rename-project.sh",
      "tinkercaster",
      "example",
      "example.test",
    ];
    const renamed = await runProcess(command, { cwd: root, timeoutMs: 10_000 });

    expect(renamed.code).toBe(0);
    expect(readFileSync(join(root, "README.md"), "utf8")).not.toContain(
      "install.sh"
    );
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");

    expect(agents).not.toContain("template-onboarding:");
    expect(agents).not.toContain("/agents.md>");
    expect(agents).toContain("never present skipped/unavailable checks as");
    expect(renamed.stdout).toContain("Format renamed files");
    writeFileSync(join(root, "README.md"), "# My product documentation\n");
    const repeated = await runProcess(command, {
      cwd: root,
      timeoutMs: 10_000,
    });

    expect(repeated.code).toBe(0);
    expect(readFileSync(join(root, "README.md"), "utf8")).toBe(
      "# My product documentation\n"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("docs stripping previews first and retains application CI and history exceptions", async () => {
  const source = fileURLToPath(new URL("../../", import.meta.url));
  const root = mkdtempSync(join(tmpdir(), "bs-strip-"));

  try {
    for (const directory of [
      "scripts",
      "apps/docs",
      "apps/api",
      ".github/workflows",
    ]) {
      mkdirSync(join(root, directory), { recursive: true });
    }

    copyFileSync(
      join(source, "scripts/strip-docs.sh"),
      join(root, "scripts/strip-docs.sh")
    );
    copyFileSync(
      join(source, ".github/dependabot.yml"),
      join(root, ".github/dependabot.yml")
    );
    writeFileSync(
      join(root, ".github/workflows/apps-docs-linkcheck.yml"),
      "docs\n"
    );
    writeFileSync(join(root, ".github/workflows/apps-api-ci.yml"), "api\n");
    writeFileSync(join(root, ".gitleaks.toml"), "historical exceptions\n");
    const command = ["/bin/bash", "scripts/strip-docs.sh"];
    const preview = await runProcess(command, { cwd: root });

    expect(preview.code).toBe(0);
    expect(
      readFileSync(
        join(root, ".github/workflows/apps-docs-linkcheck.yml"),
        "utf8"
      )
    ).toBe("docs\n");
    const applied = await runProcess([...command, "--apply"], { cwd: root });

    expect(applied.code).toBe(0);
    expect(existsSync(join(root, "apps/docs"))).toBe(false);
    expect(
      existsSync(join(root, ".github/workflows/apps-docs-linkcheck.yml"))
    ).toBe(false);
    expect(
      readFileSync(join(root, ".github/workflows/apps-api-ci.yml"), "utf8")
    ).toBe("api\n");
    expect(readFileSync(join(root, ".gitleaks.toml"), "utf8")).toBe(
      "historical exceptions\n"
    );
    const config = readFileSync(join(root, ".github/dependabot.yml"), "utf8");

    expect(config).not.toContain("directory: /apps/docs");
    expect(config).toContain("directory: /apps/api");
    expect(config).toContain("directory: /apps/ui");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("setup creates host mount directories and emits plain URLs when captured", async () => {
  const source = fileURLToPath(new URL("../../", import.meta.url));
  const root = mkdtempSync(join(tmpdir(), "bs-setup-"));

  try {
    mkdirSync(join(root, "infra/compose/compose"), { recursive: true });
    copyFileSync(join(source, "setup.sh"), join(root, "setup.sh"));
    writeFileSync(
      join(root, "infra/compose/compose/dev.sh"),
      "#!/bin/sh\nexit 0\n"
    );
    writeFileSync(
      join(root, "infra/compose/compose/.env.example"),
      [
        "GLITCHTIP_SECRET_KEY=fixture-only",
        "WITH_OBSERVABILITY=0",
        "WITH_GLITCHTIP=0",
        "WITH_BULLMQ=0",
        "WITH_MAILPIT=0",
      ].join("\n")
    );
    const result = await runProcess(["/bin/bash", "setup.sh", "--up"], {
      cwd: root,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("http://localhost:7331");
    expect(result.stdout).not.toContain("\u001B]8;");

    for (const directory of [
      "apps/api/node_modules",
      "apps/ui/node_modules",
      "apps/api/src/templates/email/dist",
    ]) {
      expect(existsSync(join(root, directory))).toBe(true);
      writeFileSync(join(root, directory, "host-writable"), "ok");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
