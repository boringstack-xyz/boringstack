#!/usr/bin/env bun
// Dependency PR steward, run by .github/workflows/deps-steward.yml.
//
//   bun scripts/deps/steward.mjs [--plan-only]
//
// Keeps every dependency PR moving without a person:
//   - Dependabot PRs and deps/* PRs get auto-merge (squash); merge-gate decides.
//   - Auto-merge armed by the workflow token is armed again with the autofix
//     token: a merge made with the workflow token starts no workflow on main,
//     so neither this steward nor the release would run after it.
//   - A PR that fell behind main is brought up to date, so the required
//     up-to-date rule never strands it. The update is pushed with the autofix
//     token, so its checks start again.
//   - A Dependabot PR whose merge-gate failed goes to the dependency agent once
//     (label deps-agent-tried). The agent makes the update land, or holds back
//     the version that cannot, with a reason in .github/dependabot.yml.
//   - A PR still failing after the agent gets the deps-needs-person label and
//     one comment: the only case left for a person.
// Nothing here merges directly, skips a check or closes a PR.
import { appendFileSync } from "node:fs";

export const AGENT_LABEL = "deps-agent-tried";
export const PERSON_LABEL = "deps-needs-person";
export const GATE = "merge-gate";

const DEPENDABOT = new Set(["dependabot[bot]", "app/dependabot", "dependabot"]);

const WORKFLOW_TOKEN = new Set(["github-actions", "app/github-actions", "github-actions[bot]"]);

export const isDependabot = (pr) => DEPENDABOT.has(pr.author);

export const isDependencyPr = (pr) =>
  isDependabot(pr) || pr.headRefName.startsWith("deps/");

/** merge-gate on the PR's head: pass, fail, pending or none. */
export function gateState(rollup) {
  const run = rollup.find((check) => (check.name ?? check.context) === GATE);

  if (run === undefined) {
    return "none";
  }

  if (run.status !== undefined && run.status !== "COMPLETED") {
    return "pending";
  }

  const conclusion = run.conclusion ?? run.state;

  if (conclusion === "SUCCESS") {
    return "pass";
  }

  return ["FAILURE", "CANCELLED", "TIMED_OUT", "ERROR", "ACTION_REQUIRED"].includes(
    conclusion
  )
    ? "fail"
    : "pending";
}

/** `gh pr list --json ...` rows to the fields the plan reads. */
export function normalize(row) {
  return {
    number: row.number,
    author: row.author?.login ?? "",
    headRefName: row.headRefName,
    isDraft: row.isDraft === true,
    autoMerge: row.autoMergeRequest !== null && row.autoMergeRequest !== undefined,
    autoMergeBy: row.autoMergeRequest?.enabledBy?.login ?? "",
    mergeState: row.mergeStateStatus ?? "UNKNOWN",
    labels: (row.labels ?? []).map((label) => label.name),
    gate: gateState(row.statusCheckRollup ?? []),
  };
}

/**
 * What to do with the open PRs. `fix` is at most one PR per run: each agent
 * run gets the runner to itself, and the next run picks up the next one.
 */
export function plan(prs, { agentsEnabled }) {
  const actions = [];
  const fixable = [];

  for (const pr of prs.filter(isDependencyPr)) {
    if (pr.isDraft) {
      continue;
    }

    if (!pr.autoMerge) {
      actions.push({ kind: "auto-merge", pr: pr.number });
    } else if (WORKFLOW_TOKEN.has(pr.autoMergeBy ?? "")) {
      actions.push({ kind: "rearm", pr: pr.number });
    }

    if (pr.mergeState === "BEHIND" && pr.gate !== "fail") {
      actions.push({ kind: "update-branch", pr: pr.number });
    }

    if (pr.gate !== "fail" || !isDependabot(pr)) {
      continue;
    }

    if (!pr.labels.includes(AGENT_LABEL)) {
      if (agentsEnabled) {
        fixable.push(pr.number);
      }
    } else if (!pr.labels.includes(PERSON_LABEL)) {
      actions.push({ kind: "needs-person", pr: pr.number });
    }
  }

  return { actions, fix: fixable.length > 0 ? Math.min(...fixable) : null };
}

const gh = (args) => {
  const run = Bun.spawnSync(["gh", ...args], { stdout: "pipe", stderr: "pipe" });

  return {
    ok: run.exitCode === 0,
    out: run.stdout.toString(),
    err: run.stderr.toString(),
  };
};

const PERSON_COMMENT =
  "The dependency agent could not make this update pass its checks, and it did not hold the version back. A person needs to look: the failing checks are on this PR.";

function execute(action) {
  const pr = String(action.pr);

  switch (action.kind) {
    case "auto-merge":
      return gh(["pr", "merge", pr, "--auto", "--squash"]);
    case "rearm": {
      const disabled = gh(["pr", "merge", pr, "--disable-auto"]);

      return disabled.ok ? gh(["pr", "merge", pr, "--auto", "--squash"]) : disabled;
    }
    case "update-branch":
      return gh(["pr", "update-branch", pr]);
    case "needs-person": {
      gh(["label", "create", PERSON_LABEL, "--force", "--color", "d93f0b", "--description", "A dependency update the agent could not land"]);
      const labelled = gh(["pr", "edit", pr, "--add-label", PERSON_LABEL]);

      return labelled.ok ? gh(["pr", "comment", pr, "--body", PERSON_COMMENT]) : labelled;
    }
    default:
      return { ok: false, out: "", err: `unknown action ${action.kind}` };
  }
}

const LIST = [
  "pr", "list", "--state", "open", "--limit", "100", "--json",
  "number,author,headRefName,isDraft,labels,autoMergeRequest,mergeStateStatus,statusCheckRollup",
];

/*
 * Right after a merge, which is when a push run starts, GitHub reports every
 * other PR's merge state as UNKNOWN until it recomputes it. Ask again a few
 * times so a PR that fell behind is still brought up to date.
 */
function listPrs() {
  for (let attempt = 0; ; attempt += 1) {
    const listed = gh(LIST);

    if (!listed.ok) {
      console.error(listed.err);
      process.exit(1);
    }

    const prs = JSON.parse(listed.out).map(normalize);
    const unknown = prs.some((pr) => isDependencyPr(pr) && pr.mergeState === "UNKNOWN");

    if (!unknown || attempt >= 5) {
      return prs;
    }

    Bun.sleepSync(10_000);
  }
}

if (import.meta.main) {
  const prs = listPrs();
  const result = plan(prs, { agentsEnabled: process.env.AGENTS_ENABLED === "1" });

  console.log(JSON.stringify(result, null, 2));

  if (process.argv.includes("--plan-only")) {
    process.exit(0);
  }

  let failed = 0;

  for (const action of result.actions) {
    const outcome = execute(action);

    console.log(`${action.kind} #${action.pr}: ${outcome.ok ? "done" : outcome.err.trim()}`);
    failed += outcome.ok ? 0 : 1;
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `fix=${result.fix ?? ""}\n`);
  }

  /* One PR that cannot be updated must not stop the others; it is retried next run. */
  if (failed > 0) {
    console.log(`${String(failed)} action(s) failed; the next run retries them.`);
  }
}
