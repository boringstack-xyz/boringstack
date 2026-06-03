import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const TOFU_EXTENSIONS = new Set([".tf", ".tftpl"]);
const SERVER_RESOURCE = 'resource "hcloud_server"';
const LIFECYCLE_GUARD_REGEX =
  /lifecycle\s*\{[^}]*ignore_changes\s*=\s*\[[^\]]*user_data/su;
const OPEN_DEFAULT_REGEX = /default\s*=\s*\[[^\]]*0\.0\.0\.0\/0/u;
const CURL_PIPE_SH_REGEX =
  /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/u;

function collectTofuFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];

  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (entry === ".terraform") {
      continue;
    }

    const full = join(dir, entry);

    let isDir: boolean;

    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      out.push(...collectTofuFiles(full));
      continue;
    }

    if (TOFU_EXTENSIONS.has(extname(full))) {
      out.push(full);
    }
  }

  return out;
}

/*
 * Three hardening invariants for the OpenTofu bootstrap, learned from the
 * 2026-06-04 audit:
 *  - hcloud_server without lifecycle ignore_changes=[user_data] is one
 *    tfvars edit away from server REPLACEMENT (cloud-init interpolates
 *    tfvars; Hetzner replaces on user_data change; the prod data dies
 *    with the server).
 *  - variable defaults containing 0.0.0.0/0 silently open admin ports
 *    to the world; opening must be an explicit operator choice.
 *  - curl|sh in cloud-init executes unverified remote code as root at
 *    first boot.
 */
export function checkTofuBootstrapHardening(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const bootstrapDir = join(dirname(dirname(root)), "infra", "bootstrap");

  if (!existsSync(bootstrapDir)) {
    return violations;
  }

  for (const file of collectTofuFiles(bootstrapDir)) {
    const text = readFileSync(file, "utf8");

    if (text.includes(SERVER_RESOURCE) && !LIFECYCLE_GUARD_REGEX.test(text)) {
      violations.push({
        file,
        rule: "tofu-server-lifecycle-guard",
        message:
          "hcloud_server must declare lifecycle { ignore_changes = [user_data] } — without it any cloud-init/tfvars change replaces the server and destroys its volumes."
      });
    }

    for (const [index, line] of text.split("\n").entries()) {
      if (OPEN_DEFAULT_REGEX.test(line)) {
        violations.push({
          file,
          rule: "tofu-no-open-admin-defaults",
          message: `Line ${String(index + 1)}: a variable default contains 0.0.0.0/0 — world-open access must be an explicit operator choice, never a default.`
        });
      }

      if (CURL_PIPE_SH_REGEX.test(line)) {
        violations.push({
          file,
          rule: "no-curl-pipe-sh",
          message: `Line ${String(index + 1)}: curl/wget piped to a shell executes unverified remote code — install via a GPG-verified package repo instead.`
        });
      }
    }
  }

  return violations;
}

/** Bootstrap IaC hardening invariants (lifecycle guard, no open defaults, no curl|sh). */
export const tofuBootstrapHardeningRule: IMetaRule = {
  id: "tofu-bootstrap-hardening",
  category: "ci",
  description:
    "infra/bootstrap must keep its hardening invariants: server lifecycle guard, no world-open variable defaults, no curl-pipe-sh.",
  run({ root }) {
    return checkTofuBootstrapHardening(root);
  }
};
