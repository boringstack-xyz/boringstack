#!/usr/bin/env bun
// Dependency advisory autofix, run by .github/workflows/deps-autofix.yml.
//
//   bun scripts/deps/autofix.mjs [--scan-only] [--no-checks] [--summary <file>]
//   bun scripts/deps/autofix.mjs --report-issue <summary.json>
//
// The run scans every app lockfile with osv-scanner (its own osv-scanner.toml
// when it has one) and gives each advisory that has a fixed version the
// minimal fixed version. A direct dependency's spec is bumped. A transitive one
// gets an `overrides` pin, mirrored into each sibling app that resolves the
// same package, which the package-override-parity lint rule requires. Then the
// app is reinstalled, rescanned and checked with its fast gate. An app whose
// checks fail is reverted and its findings are reported instead.
//
// Advisories without a fix are never ignored: they go on the deps-advisory
// tracking issue. One a person has judged not to reach production is listed
// there as accepted, with its reason, while scripts/deps/accepted.json names it
// and no fix exists. This script never edits an osv-scanner.toml ignore list.
// Only package.json and bun.lock may change; the run refuses anything else.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const APPS = ["api", "ui", "docs", "site"];
export const ALLOWED_PATH = /^apps\/(?:api|ui|docs|site)\/(?:package\.json|bun\.lock)$/;
export const ISSUE_LABEL = "deps-advisory";
export const ISSUE_TITLE = "Dependency advisories without an automatic fix";
export const BRANCH = "deps/autofix";
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

// The fast gate each app's own checks run. An app with no entry is not bumped
// until one is added: an unchecked bump is never kept.
export const CHECKS = {
  api: [["bun", "run", "check"]],
  ui: [
    ["bun", "run", "check"],
    ["bunx", "vitest", "run", "--changed", "origin/main", "--passWithNoTests"],
  ],
  docs: [
    ["bun", "run", "check:docs-data"],
    ["bun", "run", "check:fragments"],
  ],
  site: [
    ["bun", "run", "check"],
    ["bun", "run", "test"],
  ],
};

const compare = (a, b) => Bun.semver.order(a, b);
const major = (version) => version.split(".")[0];

/** Changed paths the run may not leave behind. */
export function disallowedPaths(paths) {
  return paths.filter((path) => !ALLOWED_PATH.test(path));
}

/** The fixed versions osv-scanner lists for one vulnerability of `name`. */
export function fixedVersions(vuln, name) {
  const fixed = new Set();
  for (const affected of vuln.affected ?? []) {
    if (affected.package?.name && affected.package.name !== name) continue;
    for (const range of affected.ranges ?? [])
      for (const event of range.events ?? [])
        if (event.fixed) fixed.add(event.fixed);
  }
  return [...fixed];
}

/** Flattens an osv-scanner JSON report into one row per (package, advisory). */
export function parseFindings(app, report) {
  const seen = new Map();
  for (const result of report?.results ?? [])
    for (const entry of result.packages ?? []) {
      const { name, version, ecosystem } = entry.package ?? {};
      if (!name || !version || (ecosystem && ecosystem !== "npm")) continue;
      for (const vuln of entry.vulnerabilities ?? []) {
        const key = `${name}@${version} ${vuln.id}`;
        if (!seen.has(key))
          seen.set(key, {
            app,
            name,
            version,
            id: vuln.id,
            fixed: fixedVersions(vuln, name),
          });
      }
    }
  return [...seen.values()];
}

/** The minimal fixed version newer than `version`, or null when none exists. */
export function minimalFix(version, fixed) {
  const newer = fixed.filter((v) => compare(v, version) > 0).sort(compare);
  return newer[0] ?? null;
}

/**
 * One row per app and package: the single version that clears every advisory
 * that has a fix (`target`), and the advisories that have none (`unfixed`).
 *
 * `resolvedAll(name)` lists every version the apps' lockfiles resolve for a
 * package. An override is flat, so the target must not lower a copy that is
 * already newer: when a higher version of the same major exists in the tree,
 * that version is the target.
 */
export function planFixes(findings, resolvedAll = () => []) {
  const groups = new Map();
  for (const finding of findings) {
    const key = `${finding.app}\u0000${finding.name}`;
    if (!groups.has(key))
      groups.set(key, { app: finding.app, name: finding.name, rows: [] });
    groups.get(key).rows.push(finding);
  }
  return [...groups.values()].map(({ app, name, rows }) => {
    const fixes = rows.map((row) => ({
      id: row.id,
      version: row.version,
      fix: minimalFix(row.version, row.fixed),
    }));
    const fixed = fixes.map((f) => f.fix).filter(Boolean).sort(compare).at(-1) ?? null;
    const newer = fixed
      ? resolvedAll(name)
          .filter((v) => major(v) === major(fixed) && compare(v, fixed) > 0)
          .sort(compare)
          .at(-1)
      : undefined;
    return {
      app,
      name,
      from: [...new Set(rows.map((row) => row.version))].sort(compare),
      ids: [...new Set(rows.map((row) => row.id))],
      target: newer ?? fixed,
      unfixed: fixes.filter((f) => !f.fix).map((f) => ({ id: f.id, version: f.version })),
    };
  });
}

/** Bumps every direct spec of `name`, keeping a ^ or ~ prefix. */
export function bumpDirect(manifest, name, target) {
  let changed = false;
  for (const field of DEP_FIELDS) {
    const spec = manifest[field]?.[name];
    if (spec === undefined) continue;
    const prefix = /^[\^~]/.exec(spec)?.[0] ?? "";
    manifest[field][name] = `${prefix}${target}`;
    changed = true;
  }
  return changed;
}

/** Pins `name` in `overrides` to at least `target`, with its rationale. */
export function pinOverride(manifest, name, target, { from, ids }) {
  manifest.overrides ??= {};
  manifest["//overrides"] ??= {};
  const current = manifest.overrides[name];
  if (current !== undefined && compare(current, target) >= 0) return false;
  manifest.overrides[name] = target;
  const reason = `Pin patched ${name} (${ids.join(", ")}). ${from} is vulnerable; ${target} patches it.`;
  const doc = manifest["//overrides"][name];
  manifest["//overrides"][name] =
    doc === undefined || doc.trim() === ""
      ? reason
      : doc.includes(target)
        ? doc
        : `${doc} Advanced to ${target} by deps-autofix (${ids.join(", ")}).`;
  return true;
}

/** Versions a lockfile resolves for `name`, as the override-parity rule reads them. */
export function resolvedVersions(lockText, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versions = new Set();
  for (const match of lockText.matchAll(new RegExp(`"${escaped}@(\\d[^"]*)"`, "g")))
    versions.add(match[1]);
  return [...versions];
}

/** Whether a sibling app resolves `name` at a version other than `target`. */
export function siblingNeedsPin(lockText, name, target) {
  const resolved = resolvedVersions(lockText, name);
  return resolved.length > 0 && resolved.join(",") !== target;
}

export function isDirect(manifest, name) {
  return DEP_FIELDS.some((field) => manifest[field]?.[name] !== undefined);
}

/** A manifest as the repo writes it: two-space JSON and a final newline. */
export function formatManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export const NO_FIX = "No fixed version is published yet.";

/**
 * Splits unfixed advisories into those that need a person and those accepted
 * in accepted.json. An entry covers an advisory only while it has no fixed
 * version (a failed fix still needs a person) and only until its `until` date.
 */
export function splitAccepted(unfixed, entries, today = new Date().toISOString().slice(0, 10)) {
  const open = [];
  const accepted = [];
  for (const item of unfixed) {
    const entry =
      item.reason === NO_FIX &&
      item.ids.length === 1 &&
      entries.find((e) => e.app === item.app && e.name === item.name && e.id === item.ids[0] && today <= e.until);
    if (entry) accepted.push({ ...item, reason: `${entry.reason} Accepted until ${entry.until} (#${entry.issue}).` });
    else open.push(item);
  }
  return { unfixed: open, accepted };
}

function readAccepted() {
  return JSON.parse(readFileSync(join(import.meta.dir, "accepted.json"), "utf8")).advisories;
}

const itemLine = (item) =>
  `- \`${item.name}@${item.version}\` in \`apps/${item.app}\`: ${item.ids.join(", ")}. ${item.reason}`;

/** The tracking-issue comment for the unfixed advisories, and its state key. */
export function issueComment(unfixed, accepted = []) {
  const lines = unfixed.map(itemLine);
  const acceptedLines = accepted.map(itemLine);
  const key =
    unfixed.length + accepted.length === 0
      ? "none"
      : createHash("sha256")
          .update([...lines.sort(), "accepted", ...acceptedLines.sort()].join("\n"))
          .digest("hex")
          .slice(0, 16);
  const sections = [
    unfixed.length === 0
      ? accepted.length
        ? "No dependency advisory needs a person."
        : "No dependency advisory is left without an automatic fix."
      : [
          "These advisories have no fixed version that deps-autofix can apply, or its fix failed the app's checks. They are not ignored: each needs a person.",
          "",
          ...lines,
        ].join("\n"),
  ];
  if (accepted.length)
    sections.push(
      [
        "Accepted while no fix exists (`scripts/deps/accepted.json`). Each is fixed automatically once a fixed version is published:",
        "",
        ...acceptedLines,
      ].join("\n"),
    );
  return { key, body: `${sections.join("\n\n")}\n\n<!-- deps-autofix-state: ${key} -->` };
}

/** The state key of the newest comment that carries one, or null. */
export function lastIssueState(commentBodies) {
  for (const body of [...commentBodies].reverse()) {
    const match = /<!-- deps-autofix-state: ([a-z0-9]+) -->/.exec(body ?? "");
    if (match) return match[1];
  }
  return null;
}

export function prBody(summary) {
  const bumps = summary.bumps.map(
    (b) =>
      `- \`${b.name}\` ${b.from.join(", ")} -> ${b.to} in \`apps/${b.app}\` (${b.mode}; ${b.ids.join(", ")})`,
  );
  const unfixed = [...summary.unfixed, ...(summary.accepted ?? [])].map(itemLine);
  return [
    "Automatic dependency advisory fixes, opened by `deps-autofix` (`.github/workflows/deps-autofix.yml`).",
    "",
    "## Bumped",
    ...(bumps.length ? bumps : ["- nothing"]),
    "",
    "## Not fixed",
    ...(unfixed.length ? unfixed : ["- nothing"]),
    "",
    "Only `package.json` and `bun.lock` changed. Each app ran its fast checks and an osv-scanner rescan before this PR was opened; merge-gate runs the full suites.",
  ].join("\n");
}

// ---- runner ---------------------------------------------------------------

function workDir() {
  const dir = process.env.DEPS_AUTOFIX_DIR ?? join(process.env.RUNNER_TEMP ?? tmpdir(), "deps-autofix");
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function scan(app, dir) {
  const out = join(dir, `osv-${app}.json`);
  const args = [process.env.OSV_SCANNER ?? "osv-scanner", "--lockfile=bun.lock", "--format=json", `--output-file=${out}`];
  if (existsSync(join("apps", app, "osv-scanner.toml"))) args.push("--config=osv-scanner.toml");
  const proc = Bun.spawn(args, { cwd: join("apps", app), stdout: "ignore", stderr: "ignore" });
  const code = await proc.exited;
  // 0: clean, 1: findings. Anything else is a broken scan, not a clean one.
  if (code !== 0 && code !== 1) throw new Error(`osv-scanner failed for ${app} (exit ${code})`);
  return parseFindings(app, JSON.parse(readFileSync(out, "utf8")));
}

async function run(cmd, cwd, log, env = process.env) {
  // Start each log empty, so a stale one can never be read as this run's output.
  writeFileSync(log, "");
  const proc = Bun.spawn(cmd, { cwd, stdout: Bun.file(log), stderr: Bun.file(log), env });
  if ((await proc.exited) !== 0) {
    const tail = readFileSync(log, "utf8").trim().split("\n").slice(-3).join(" | ");
    throw new Error(`\`${cmd.join(" ")}\` failed: ${tail}`.slice(0, 600));
  }
}

async function runChecks(app, dir) {
  const appDir = join("apps", app);
  const log = join(dir, `check-${app}.log`);
  for (const cmd of CHECKS[app] ?? []) await run(cmd, appDir, log);
}

async function changedPaths() {
  const proc = Bun.spawn(["git", "status", "--porcelain", "--untracked-files=all", "--", "apps"], { stdout: "pipe" });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, ""));
}

const itemKey = (item) => `${item.app} ${item.name} ${item.version} ${item.ids.join(",")}`;

async function fix(summaryPath, { checks }) {
  const dir = workDir();
  const apps = APPS.filter((app) => existsSync(join("apps", app, "bun.lock")));
  const findings = [];
  for (const app of apps) findings.push(...(await scan(app, dir)));
  const lockTexts = Object.fromEntries(apps.map((app) => [app, readFileSync(join("apps", app, "bun.lock"), "utf8")]));
  const plans = planFixes(findings, (name) => apps.flatMap((app) => resolvedVersions(lockTexts[app], name)));
  const fixable = plans.filter((plan) => plan.target);
  const summary = { bumps: [], unfixed: [], accepted: [], checked: [], scanned: apps, findings: findings.length };
  const unfixed = new Map();
  const addUnfixed = (item) => unfixed.set(itemKey(item), item);
  for (const plan of plans)
    for (const item of plan.unfixed)
      addUnfixed({ app: plan.app, name: plan.name, version: item.version, ids: [item.id], reason: NO_FIX });

  // Advisories accepted in accepted.json move out of `unfixed`.
  const settle = () => Object.assign(summary, splitAccepted([...unfixed.values()], readAccepted()));
  if (fixable.length === 0) {
    settle();
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    return summary;
  }

  // Snapshot every app first, so a failed app can be restored exactly.
  const snapshot = {};
  const manifests = {};
  const locks = {};
  for (const app of apps) {
    snapshot[app] = {
      pkg: readFileSync(join("apps", app, "package.json"), "utf8"),
      lock: readFileSync(join("apps", app, "bun.lock"), "utf8"),
    };
    manifests[app] = JSON.parse(snapshot[app].pkg);
    locks[app] = snapshot[app].lock;
  }
  const edits = new Map(); // app -> bump entries
  const note = (app, entry) => edits.set(app, [...(edits.get(app) ?? []), entry]);
  for (const plan of fixable) {
    const entry = { name: plan.name, from: plan.from, to: plan.target, ids: plan.ids };
    const owner = manifests[plan.app];
    if (isDirect(owner, plan.name)) {
      if (bumpDirect(owner, plan.name, plan.target)) note(plan.app, { ...entry, mode: "direct" });
    } else if (pinOverride(owner, plan.name, plan.target, { from: plan.from.join(", "), ids: plan.ids })) {
      note(plan.app, { ...entry, mode: "override" });
    }
    // The override-parity rule: a sibling that resolves the package at another
    // version must pin it too.
    for (const sibling of apps) {
      if (sibling === plan.app || !siblingNeedsPin(locks[sibling], plan.name, plan.target)) continue;
      const pinned = isDirect(manifests[sibling], plan.name)
        ? bumpDirect(manifests[sibling], plan.name, plan.target)
        : pinOverride(manifests[sibling], plan.name, plan.target, { from: plan.from.join(", "), ids: plan.ids });
      if (pinned) note(sibling, { ...entry, mode: "mirror" });
    }
  }

  const edited = apps.filter((app) => formatManifest(manifests[app]) !== snapshot[app].pkg);
  for (const app of edited) writeFileSync(join("apps", app, "package.json"), formatManifest(manifests[app]));

  // Install every edited app before any check: the override-parity lint rule
  // reads all apps' manifests and lockfiles, so each must be in sync first.
  // A failed install is a failed app like any other, so it is caught below.
  const installed = new Map();
  for (const app of edited) {
    try {
      await run(["bun", "install"], join("apps", app), join(dir, `install-${app}.log`));
      await run(["bun", "install", "--frozen-lockfile"], join("apps", app), join(dir, `install-${app}.log`));
      installed.set(app, null);
    } catch (error) {
      installed.set(app, error);
    }
  }

  // Rescan and check each edited app. A failing app is restored.
  for (const app of edited) {
    const appDir = join("apps", app);
    try {
      if (installed.get(app)) throw installed.get(app);
      const remaining = await scan(app, dir);
      const stuck = remaining.filter((row) => minimalFix(row.version, row.fixed));
      if (stuck.length) throw new Error(`the bump did not clear ${stuck.map((row) => row.id).join(", ")}`);
      for (const row of remaining)
        addUnfixed({ app, name: row.name, version: row.version, ids: [row.id], reason: NO_FIX });
      if (checks) await runChecks(app, dir);
      summary.checked.push(app);
      summary.bumps.push(...(edits.get(app) ?? []).map((entry) => ({ app, ...entry })));
    } catch (error) {
      writeFileSync(join(appDir, "package.json"), snapshot[app].pkg);
      writeFileSync(join(appDir, "bun.lock"), snapshot[app].lock);
      console.error(`::warning::${app} left unchanged: ${error.message}`);
      for (const plan of fixable.filter((p) => p.app === app || edits.get(app)?.some((e) => e.name === p.name)))
        addUnfixed({ app: plan.app, name: plan.name, version: plan.from.join(", "), ids: plan.ids, reason: `Not applied: ${error.message}` });
    }
  }
  settle();

  const bad = disallowedPaths(await changedPaths());
  if (bad.length) throw new Error(`Refusing: changes outside package.json and bun.lock: ${bad.join(", ")}`);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  return summary;
}

async function gh(args) {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "inherit" });
  const out = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(`gh ${args[0]} ${args[1]} failed`);
  return out.trim();
}

async function reportIssue(summaryPath) {
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const repo = process.env.GITHUB_REPOSITORY;
  const { key, body } = issueComment(summary.unfixed, summary.accepted ?? []);
  const listed = JSON.parse(await gh(["issue", "list", "--repo", repo, "--label", ISSUE_LABEL, "--state", "open", "--json", "number,title"]));
  let issue = listed.find((item) => item.title === ISSUE_TITLE);
  if (!issue) {
    if (key === "none") return console.log("No unfixed advisories and no tracking issue: nothing to record.");
    await gh(["label", "create", ISSUE_LABEL, "--repo", repo, "--force", "--color", "d93f0b", "--description", "Dependency advisory with no automatic fix"]);
    const url = await gh(["issue", "create", "--repo", repo, "--title", ISSUE_TITLE, "--label", ISSUE_LABEL, "--body", "Tracked by deps-autofix. Each comment lists the advisories it could not fix automatically."]);
    issue = { number: Number(url.split("/").pop()) };
  }
  const { comments } = JSON.parse(await gh(["issue", "view", String(issue.number), "--repo", repo, "--json", "comments"]));
  if (lastIssueState(comments.map((c) => c.body)) === key) return console.log(`Tracking issue #${issue.number} already shows this state.`);
  const file = join(workDir(), "issue-comment.md");
  writeFileSync(file, body);
  await gh(["issue", "comment", String(issue.number), "--repo", repo, "--body-file", file]);
  console.log(`Posted to tracking issue #${issue.number}.`);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  if (args.includes("--report-issue")) {
    await reportIssue(value("--report-issue"));
  } else if (args.includes("--scan-only")) {
    for (const app of APPS.filter((a) => existsSync(join("apps", a, "bun.lock")))) {
      for (const row of await scan(app, workDir()))
        console.log(`${row.app}\t${row.name}@${row.version}\t${row.id}\tfixed: ${row.fixed.join(",") || "none"}`);
    }
  } else {
    const summary = await fix(value("--summary", join(workDir(), "summary.json")), { checks: !args.includes("--no-checks") });
    writeFileSync(join(workDir(), "pr-body.md"), prBody(summary));
    console.log(`Bumped ${summary.bumps.length} package(s); ${summary.unfixed.length} advisory item(s) without a fix.`);
    for (const bump of summary.bumps) console.log(`  ${bump.app}: ${bump.name} ${bump.from.join(", ")} -> ${bump.to} (${bump.mode})`);
  }
}
