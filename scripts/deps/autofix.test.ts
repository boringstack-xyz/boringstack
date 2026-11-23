import { describe, expect, test } from "bun:test";
import {
  APPS,
  bumpDirect,
  CHECKS,
  disallowedPaths,
  formatManifest,
  issueComment,
  lastIssueState,
  minimalFix,
  parseFindings,
  pinOverride,
  planFixes,
  prBody,
  resolvedVersions,
  siblingNeedsPin,
  splitAccepted,
} from "./autofix.mjs";

const vuln = (id: string, name: string, fixed: string[]) => ({
  id,
  affected: [
    {
      package: { name, ecosystem: "npm" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, ...fixed.map((f) => ({ fixed: f }))] }],
    },
  ],
});

const report = (name: string, version: string, vulns: unknown[]) => ({
  results: [{ packages: [{ package: { name, version, ecosystem: "npm" }, vulnerabilities: vulns }] }],
});

describe("disallowedPaths", () => {
  test("allows only package.json and bun.lock of the four apps", () => {
    expect(
      disallowedPaths([
        "apps/ui/package.json",
        "apps/ui/bun.lock",
        "apps/api/package.json",
        "apps/site/bun.lock",
        "apps/docs/package.json",
        "apps/docs/bun.lock",
      ]),
    ).toEqual([]);
  });

  test("scans and checks every app that has a lockfile", () => {
    for (const app of APPS) expect(CHECKS[app]?.length).toBeGreaterThan(0);
    expect(APPS).toEqual(["api", "ui", "docs", "site"]);
  });

  test("refuses other files, fixtures, the ignore lists and workflows", () => {
    expect(
      disallowedPaths([
        "apps/ui/osv-scanner.toml",
        "apps/api/tests/lint-meta/fixtures/override-parity-drift/app-a/package.json",
        ".github/workflows/deps-autofix.yml",
        "apps/site/src/index.ts",
        "apps/docs/src/main.tsx",
        "infra/bootstrap/bun.lock",
      ]),
    ).toEqual([
      "apps/ui/osv-scanner.toml",
      "apps/api/tests/lint-meta/fixtures/override-parity-drift/app-a/package.json",
      ".github/workflows/deps-autofix.yml",
      "apps/site/src/index.ts",
      "apps/docs/src/main.tsx",
      "infra/bootstrap/bun.lock",
    ]);
  });
});

describe("parseFindings and planFixes", () => {
  test("reads fixed versions and dedupes one advisory per package version", () => {
    const rows = parseFindings(
      "site",
      report("vite", "8.3.0", [
        vuln("GHSA-a", "vite", ["1.1.0", "8.2.4", "8.3.3"]),
        vuln("GHSA-a", "vite", ["8.3.3"]),
        vuln("GHSA-b", "vite", ["8.3.3"]),
      ]),
    );
    expect(rows.map((r) => r.id)).toEqual(["GHSA-a", "GHSA-b"]);
    expect(rows[0]?.fixed).toEqual(["1.1.0", "8.2.4", "8.3.3"]);
  });

  test("ignores non-npm packages", () => {
    const doc = {
      results: [{ packages: [{ package: { name: "x", version: "1.0.0", ecosystem: "PyPI" }, vulnerabilities: [vuln("GHSA-z", "x", ["1.0.1"])] }] }],
    };
    expect(parseFindings("api", doc)).toEqual([]);
  });

  test("minimalFix picks the lowest fixed version above the installed one", () => {
    expect(minimalFix("0.7.3", ["0.4.9", "0.5.4", "0.6.11", "0.7.5", "0.8.3"])).toBe("0.7.5");
    expect(minimalFix("8.3.0", ["1.1.0", "8.2.4", "8.3.3"])).toBe("8.3.3");
    expect(minimalFix("4.2.0", [])).toBeNull();
  });

  test("planFixes never lowers a copy the tree already resolves higher in the same major", () => {
    const rows = parseFindings("site", report("fflate", "0.7.3", [vuln("GHSA-f", "fflate", ["0.7.5", "0.8.3"])]));
    // ui resolves 0.8.3 (not vulnerable): the flat override must land on 0.8.3.
    expect(planFixes(rows, () => ["0.7.3", "0.8.3"])[0]?.target).toBe("0.8.3");
    // A higher major in the tree is not a reason to move to it.
    expect(planFixes(rows, () => ["0.7.3", "1.0.0"])[0]?.target).toBe("0.7.5");
    expect(planFixes(rows)[0]?.target).toBe("0.7.5");
  });

  test("planFixes gives one target per package and keeps the advisories with no fix", () => {
    const rows = [
      ...parseFindings("site", report("vite", "8.3.0", [vuln("GHSA-a", "vite", ["8.3.3"]), vuln("GHSA-b", "vite", ["8.2.4", "8.3.3"])])),
      ...parseFindings("site", report("http-cache-semantics", "4.2.0", [vuln("GHSA-c", "http-cache-semantics", [])])),
    ];
    const plans = planFixes(rows);
    const vite = plans.find((p) => p.name === "vite");
    expect(vite?.target).toBe("8.3.3");
    expect(vite?.ids).toEqual(["GHSA-a", "GHSA-b"]);
    const hcs = plans.find((p) => p.name === "http-cache-semantics");
    expect(hcs?.target).toBeNull();
    expect(hcs?.unfixed).toEqual([{ id: "GHSA-c", version: "4.2.0" }]);
  });
});

describe("manifest edits", () => {
  test("bumpDirect keeps an exact pin exact and a caret range a caret", () => {
    const manifest: Record<string, Record<string, string>> = {
      dependencies: { nodemailer: "10.0.9", sharp: "^0.35.4" },
    };
    expect(bumpDirect(manifest, "nodemailer", "10.0.10")).toBe(true);
    expect(bumpDirect(manifest, "sharp", "0.35.5")).toBe(true);
    expect(manifest.dependencies).toEqual({ nodemailer: "10.0.10", sharp: "^0.35.5" });
    expect(bumpDirect(manifest, "missing", "1.0.0")).toBe(false);
  });

  test("pinOverride adds an override with its rationale", () => {
    const manifest: Record<string, unknown> = { overrides: {}, "//overrides": {} };
    expect(pinOverride(manifest, "devalue", "5.9.3", { from: "5.9.2", ids: ["GHSA-x"] })).toBe(true);
    expect((manifest.overrides as Record<string, string>).devalue).toBe("5.9.3");
    expect((manifest["//overrides"] as Record<string, string>).devalue).toContain("5.9.2 is vulnerable; 5.9.3 patches it");
  });

  test("pinOverride raises an existing pin and records the advance, but never lowers one", () => {
    const manifest: Record<string, unknown> = {
      overrides: { "ip-address": "10.7.2" },
      "//overrides": { "ip-address": "Pin patched ip-address (GHSA-rxp7-6hxx-x8q5)." },
    };
    expect(pinOverride(manifest, "ip-address", "10.7.4", { from: "10.7.2", ids: ["GHSA-rxp7-6hxx-x8q5"] })).toBe(true);
    expect((manifest.overrides as Record<string, string>)["ip-address"]).toBe("10.7.4");
    expect((manifest["//overrides"] as Record<string, string>)["ip-address"]).toContain("Advanced to 10.7.4");
    expect(pinOverride(manifest, "ip-address", "10.7.3", { from: "10.7.2", ids: ["GHSA-x"] })).toBe(false);
  });

  test("formatManifest writes two-space JSON with a final newline", () => {
    expect(formatManifest({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe("override parity", () => {
  const lock = `"nodemailer@10.0.9", "", {}, "sha"\n"ip-address@10.7.2", "", {}, "sha"\n"ip-address@10.7.4", "", {}, "sha"`;

  test("resolvedVersions reads every resolution of a name", () => {
    expect(resolvedVersions(lock, "ip-address")).toEqual(["10.7.2", "10.7.4"]);
    expect(resolvedVersions(lock, "nope")).toEqual([]);
  });

  test("a sibling needs a pin only when it resolves the package at another version", () => {
    expect(siblingNeedsPin(lock, "nodemailer", "10.0.10")).toBe(true);
    expect(siblingNeedsPin(`"nodemailer@10.0.10", "", {}`, "nodemailer", "10.0.10")).toBe(false);
    expect(siblingNeedsPin(lock, "absent", "1.0.0")).toBe(false);
  });
});

describe("tracking issue", () => {
  const unfixed = [{ app: "site", name: "http-cache-semantics", version: "4.2.0", ids: ["GHSA-ch52-4w7c-c8xp"], reason: "No fixed version is published yet." }];

  test("the state key changes with the unfixed set and is stable for the same set", () => {
    const a = issueComment(unfixed);
    expect(a.key).not.toBe("none");
    expect(issueComment([...unfixed]).key).toBe(a.key);
    expect(issueComment([]).key).toBe("none");
  });

  test("the comment names every advisory and carries its state key", () => {
    const { body, key } = issueComment(unfixed);
    expect(body).toContain("GHSA-ch52-4w7c-c8xp");
    expect(body).toContain(`<!-- deps-autofix-state: ${key} -->`);
  });

  test("accepted advisories get their own section, not the needs-a-person list", () => {
    const { body, key } = issueComment([], unfixed);
    expect(key).not.toBe("none");
    expect(key).not.toBe(issueComment(unfixed).key);
    expect(body).toContain("No dependency advisory needs a person.");
    expect(body).toContain("Accepted while no fix exists");
    expect(body).toContain("GHSA-ch52-4w7c-c8xp");
  });

  test("lastIssueState reads the newest comment that carries a key", () => {
    expect(lastIssueState(["hello", "<!-- deps-autofix-state: abc123 -->", "thanks"])).toBe("abc123");
    expect(lastIssueState(["no marker"])).toBeNull();
  });
});

describe("accepted advisories", () => {
  const entry = { app: "site", name: "http-cache-semantics", id: "GHSA-c", until: "2027-01-31", issue: 188, reason: "Build time only." };
  const item = { app: "site", name: "http-cache-semantics", version: "4.2.0", ids: ["GHSA-c"], reason: "No fixed version is published yet." };

  test("an entry moves its unfixed advisory to accepted, with the reason", () => {
    const { unfixed, accepted } = splitAccepted([item], [entry], "2026-10-24");
    expect(unfixed).toEqual([]);
    expect(accepted[0].reason).toBe("Build time only. Accepted until 2027-01-31 (#188).");
  });

  test("it lapses after its date and never covers a failed fix or another app", () => {
    expect(splitAccepted([item], [entry], "2027-02-01").unfixed).toEqual([item]);
    const failed = { ...item, reason: "Not applied: the bump did not clear GHSA-c" };
    expect(splitAccepted([failed], [entry], "2026-10-24").unfixed).toEqual([failed]);
    const ui = { ...item, app: "ui" };
    expect(splitAccepted([ui], [entry], "2026-10-24").unfixed).toEqual([ui]);
  });

  test("the checked-in list is well formed", async () => {
    const { advisories } = await Bun.file(new URL("./accepted.json", import.meta.url)).json();
    for (const e of advisories) {
      expect(APPS).toContain(e.app);
      expect(e.id).toMatch(/^GHSA-/);
      expect(e.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.reason.length).toBeGreaterThan(20);
      expect(typeof e.issue).toBe("number");
    }
  });
});

describe("pull request body", () => {
  test("lists bumps and what was not fixed", () => {
    const body = prBody({
      bumps: [{ app: "site", name: "vite", from: ["8.3.0"], to: "8.3.3", ids: ["GHSA-a"], mode: "override" }],
      unfixed: [{ app: "site", name: "http-cache-semantics", version: "4.2.0", ids: ["GHSA-c"], reason: "No fixed version is published yet." }],
    });
    expect(body).toContain("`vite` 8.3.0 -> 8.3.3 in `apps/site` (override; GHSA-a)");
    expect(body).toContain("`http-cache-semantics@4.2.0` in `apps/site`: GHSA-c.");
  });
});
