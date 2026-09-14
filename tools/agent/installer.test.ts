import { expect, test } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process";

const INSTALLER_FILENAME = "install.sh";
const OVERRIDES_FILENAME = "private.env";

const installer = fileURLToPath(
  new URL("../../apps/docs/public/install.sh", import.meta.url)
);

test.skipIf(!existsSync(installer))(
  "installer applies local dotenv overrides without printing values",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "bs-install-"));

    try {
      mkdirSync(join(root, "bin"));
      mkdirSync(join(root, "template/infra/compose/compose"), {
        recursive: true,
      });
      copyFileSync(installer, join(root, INSTALLER_FILENAME));
      writeFileSync(join(root, "template/setup.sh"), "#!/bin/sh\nexit 0\n");
      writeFileSync(
        join(root, "template/infra/compose/compose/.env.example"),
        "WITH_OBSERVABILITY=1\n# SUPERUSER_PASSWORD=\n"
      );
      writeFileSync(
        join(root, OVERRIDES_FILENAME),
        "WITH_OBSERVABILITY=0\nSUPERUSER_PASSWORD=fixture-local-value\n"
      );
      writeFileSync(
        join(root, "bin/git"),
        '#!/bin/sh\nif [ "$1" = clone ]; then\n for target do :; done\n mkdir -p "$target"\n cp -R "$TEMPLATE/." "$target"\nfi\n'
      );
      chmodSync(join(root, "bin/git"), 0o755);
      const result = await runProcess(
        [
          "/bin/sh",
          INSTALLER_FILENAME,
          "--project",
          "fixture",
          "--ref",
          "fixture",
          "--no-boot",
          "--no-rename",
          "--env-file",
          OVERRIDES_FILENAME,
        ],
        {
          cwd: root,
          env: {
            PATH: `${join(root, "bin")}:/usr/bin:/bin`,
            TEMPLATE: join(root, "template"),
          },
          timeoutMs: 10_000,
        }
      );

      expect(result.code).toBe(0);
      expect(result.stdout + result.stderr).not.toContain(
        "fixture-local-value"
      );
      expect(
        readFileSync(join(root, "fixture/infra/compose/compose/.env"), "utf8")
      ).toBe(
        "WITH_OBSERVABILITY=1\n# SUPERUSER_PASSWORD=\n\nWITH_OBSERVABILITY=0\nSUPERUSER_PASSWORD=fixture-local-value\n"
      );
      expect(
        statSync(join(root, "fixture/infra/compose/compose/.env")).mode & 0o777
      ).toBe(0o600);
      writeFileSync(
        join(root, "template/infra/compose/compose/.env"),
        "EXISTING=preserved\n"
      );
      const refused = await runProcess(
        [
          "/bin/sh",
          INSTALLER_FILENAME,
          "--project",
          "second",
          "--ref",
          "fixture",
          "--no-boot",
          "--no-rename",
          "--env-file",
          OVERRIDES_FILENAME,
        ],
        {
          cwd: root,
          env: {
            PATH: `${join(root, "bin")}:/usr/bin:/bin`,
            TEMPLATE: join(root, "template"),
          },
          timeoutMs: 10_000,
        }
      );

      writeFileSync(
        join(root, OVERRIDES_FILENAME),
        "VALUE=$(touch unexpected)\n"
      );
      const invalid = await runProcess(
        [
          "/bin/sh",
          INSTALLER_FILENAME,
          "--project",
          "invalid",
          "--env-file",
          OVERRIDES_FILENAME,
          "--dry-run",
        ],
        {
          cwd: root,
          env: {
            PATH: `${join(root, "bin")}:/usr/bin:/bin`,
            TEMPLATE: join(root, "template"),
          },
          timeoutMs: 10_000,
        }
      );

      rmSync(join(root, "template/infra/compose/compose/.env"));
      writeFileSync(
        join(root, OVERRIDES_FILENAME),
        "BASH_ENV=/tmp/untrusted-hook\n"
      );
      const unknownKey = await runProcess(
        [
          "/bin/sh",
          INSTALLER_FILENAME,
          "--project",
          "unknown",
          "--ref",
          "fixture",
          "--no-boot",
          "--no-rename",
          "--env-file",
          OVERRIDES_FILENAME,
        ],
        {
          cwd: root,
          env: {
            PATH: `${join(root, "bin")}:/usr/bin:/bin`,
            TEMPLATE: join(root, "template"),
          },
          timeoutMs: 10_000,
        }
      );

      expect(unknownKey.code).toBe(6);
      expect(existsSync(join(root, "unknown/infra/compose/compose/.env"))).toBe(
        false
      );
      expect(invalid.code).toBe(2);
      expect(invalid.stderr).not.toContain("touch unexpected");
      expect(existsSync(join(root, "unexpected"))).toBe(false);
      expect(refused.code).toBe(6);
      expect(
        readFileSync(join(root, "second/infra/compose/compose/.env"), "utf8")
      ).toBe("EXISTING=preserved\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  45_000
);
