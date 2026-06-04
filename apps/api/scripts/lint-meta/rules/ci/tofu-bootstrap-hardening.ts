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
const REQUIRED_PROVIDERS_REGEX = /required_providers\s*\{/gu;
const PROVIDER_ENTRY_REGEX = /(\w+)\s*=\s*\{([^}]*)\}/gu;

/*
 * Extract the body of every `required_providers { … }` block by walking
 * brace depth from the opening brace — a regex can't because each provider
 * entry is itself a `{ … }`.
 */
function requiredProvidersBodies(text: string): string[] {
  const bodies: string[] = [];

  for (const match of text.matchAll(REQUIRED_PROVIDERS_REGEX)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;

    while (index < text.length && depth > 0) {
      const char = text[index];

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
      }

      index += 1;
    }

    bodies.push(text.slice(start, index - 1));
  }

  return bodies;
}

function providerVersionViolations(file: string, text: string): IViolation[] {
  const out: IViolation[] = [];

  for (const body of requiredProvidersBodies(text)) {
    for (const entry of body.matchAll(PROVIDER_ENTRY_REGEX)) {
      const name = entry[1] ?? "provider";
      const inner = entry[2] ?? "";

      if (!inner.includes("version")) {
        out.push({
          file,
          rule: "tofu-provider-version-pin",
          message: `required_providers entry \`${name}\` has no version constraint — pin every provider (e.g. version = "~> 1.48") so module plans stay reproducible when reused independently of the root.`,
        });
      }
    }
  }

  return out;
}

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
 * Hardening invariants for the OpenTofu bootstrap, learned from the
 * 2026-06-04 audits:
 *  - hcloud_server without lifecycle ignore_changes=[user_data] is one
 *    tfvars edit away from server REPLACEMENT (cloud-init interpolates
 *    tfvars; Hetzner replaces on user_data change; the prod data dies
 *    with the server).
 *  - variable defaults containing 0.0.0.0/0 silently open admin ports
 *    to the world; opening must be an explicit operator choice.
 *  - curl|sh in cloud-init executes unverified remote code as root at
 *    first boot.
 *  - a required_providers entry without a version constraint floats to
 *    any newer major; the root pinned its providers but the modules did
 *    not, so a module reused on its own would plan non-reproducibly.
 */
export function checkTofuBootstrapHardening(root: string): IViolation[] {
  const violations: IViolation[] = [];
  const bootstrapDir = join(dirname(dirname(root)), "infra", "bootstrap");

  if (!existsSync(bootstrapDir)) {
    return violations;
  }

  for (const file of collectTofuFiles(bootstrapDir)) {
    const text = readFileSync(file, "utf8");

    violations.push(...providerVersionViolations(file, text));

    if (text.includes(SERVER_RESOURCE) && !LIFECYCLE_GUARD_REGEX.test(text)) {
      violations.push({
        file,
        rule: "tofu-server-lifecycle-guard",
        message:
          "hcloud_server must declare lifecycle { ignore_changes = [user_data] } — without it any cloud-init/tfvars change replaces the server and destroys its volumes.",
      });
    }

    for (const [index, line] of text.split("\n").entries()) {
      if (OPEN_DEFAULT_REGEX.test(line)) {
        violations.push({
          file,
          rule: "tofu-no-open-admin-defaults",
          message: `Line ${String(index + 1)}: a variable default contains 0.0.0.0/0 — world-open access must be an explicit operator choice, never a default.`,
        });
      }

      if (CURL_PIPE_SH_REGEX.test(line)) {
        violations.push({
          file,
          rule: "no-curl-pipe-sh",
          message: `Line ${String(index + 1)}: curl/wget piped to a shell executes unverified remote code — install via a GPG-verified package repo instead.`,
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
    "infra/bootstrap must keep its hardening invariants: server lifecycle guard, no world-open variable defaults, no curl-pipe-sh, version-pinned required_providers.",
  run({ root }) {
    return checkTofuBootstrapHardening(root);
  },
};
