import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ParseArgsOptionsConfig, parseArgs } from "node:util";

import { nowMs } from "../clock";
import type { IFactoryCommand } from "../command.types";
import type { IFactoryContext } from "../context";
import { ledgerPathOf } from "../fleet/findings";
import { parseLedger } from "../fleet/findings.utils";
import { type ProcessRunner, runProcess } from "../fleet/process";
import { blocked, failed, type ICommandOutcome, ok } from "../result";
import { readJson, writeText } from "../state";
import { digestMarkdown, parsePulls, parseRuns } from "./digest";
import {
  capDecision,
  laneNamed,
  laneProblems,
  LANES,
  lanesList,
  parsePrRows,
} from "./lanes";
import { ceilingOf, decideRisk } from "../risk/risk";
import { replaceReviewSection, reviewSectionOf } from "./review";
import { type IProofReport, proveFix } from "./prove-fix";
import { reportOf } from "./run-report";
import {
  dispatchInput,
  parseTriageInput,
  readPlan,
  triageBatch,
  triageComment,
} from "./triage";

/*
 * `bun run factory lanes ...`: the agent lanes' helpers. The workflows in
 * .github/workflows/agent-*.yml call these; each one reads its input from a
 * file or stdin and writes its output to a file, so the summary line stays a
 * plain sentence.
 */

export interface ILanesDeps {
  readonly run: ProcessRunner;
  readonly now: () => number;
  /** Reads stdin when the command takes its input from a pipe. */
  readonly stdin: () => string;
}

/** What the triage command needs from the factory context. */
export type ILanesContext = Pick<IFactoryContext, "sharedDir" | "root">;

interface IParsed {
  readonly values: Record<
    string,
    string | boolean | (string | boolean)[] | undefined
  >;
  readonly positionals: string[];
}

const readStdin = (): string => {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
};

const readText = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

const splitLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const unknownLane = (name: string | undefined): string =>
  `Unknown lane: ${name ?? "(none)"}. Lanes: ${Object.keys(LANES).join(", ")}.`;

/** Arguments by name, or the reason they do not parse. */
const parse = (
  args: readonly string[],
  options: ParseArgsOptionsConfig
): IParsed | string => {
  try {
    const parsed = parseArgs({
      args: [...args],
      strict: true,
      allowPositionals: true,
      options,
    });

    return { values: parsed.values, positionals: parsed.positionals };
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

/** `lanes scope <lane>`: the change set on stdin must be one the lane allows. */
export const scopeRun = (
  args: readonly string[],
  deps: ILanesDeps
): ICommandOutcome => {
  const lane = laneNamed(args[0]);

  if (lane === undefined) {
    return failed(unknownLane(args[0]));
  }

  const problems = laneProblems(lane, splitLines(deps.stdin()));

  return problems.length === 0
    ? ok(`The change is within the ${lane} lane.`)
    : failed(problems.join("\n"));
};

/** `lanes prove [--report=<file>] [paths...]`: paths come from the arguments or stdin. */
export const proveRun = (
  args: readonly string[],
  deps: ILanesDeps
): ICommandOutcome => {
  const parsed = parse(args, { report: { type: "string" } });

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const paths =
    parsed.positionals.length > 0
      ? parsed.positionals
      : splitLines(deps.stdin());
  /* The checkout the command runs in: a workflow runs it from the PR's checkout, not the factory's. */
  const top = deps.run("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    timeoutMs: 30_000,
  });

  if (top.status !== 0) {
    return blocked("The proof must run inside a git checkout.");
  }

  const root = top.stdout.trim();
  const named = parsed.values.report;
  const reportFile =
    typeof named === "string"
      ? named
      : join(root, ".agent-state", "factory", "prove-fix.json");
  let report: IProofReport;

  try {
    report = proveFix(paths, { run: deps.run, root });
  } catch (error: unknown) {
    return blocked(
      `The proof could not run: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  writeText(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  return ok(
    `${report.proven ? "Proven" : "Not proven"}: ${report.reason} Report: ${reportFile}`,
    { proven: report.proven, reason: report.reason, report: reportFile }
  );
};

/** `lanes report <transcript> <out.md> [--title=...]`: the run's summary as Markdown. */
export const reportRun = (args: readonly string[]): ICommandOutcome => {
  const parsed = parse(args, {
    title: { type: "string", default: "Agent run" },
  });

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const [transcript = "", out = ""] = parsed.positionals;

  if (transcript === "" || out === "") {
    return failed("Usage: lanes report <transcript> <out.md> [--title=...]");
  }

  writeText(out, reportOf(transcript, String(parsed.values.title)));

  return ok(`Run summary written to ${out}.`);
};

/** `lanes triage [--dispatch]`: the next findings from the ledger, optionally sent to the triage workflow. */
export const triageRun = (
  args: readonly string[],
  context: ILanesContext,
  deps: ILanesDeps
): ICommandOutcome => {
  const parsed = parse(args, {
    dispatch: { type: "boolean", default: false },
  });

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const raw = readJson(ledgerPathOf(context.sharedDir));

  if (raw === undefined) {
    return blocked(
      "There is no findings ledger yet. Run bun run factory findings first, then triage."
    );
  }

  const batch = triageBatch(parseLedger(raw));

  if (batch.length === 0) {
    return ok("No findings are waiting for triage.", { batch: 0 });
  }

  const listing = batch
    .map(
      (finding) =>
        `  ${finding.id} ${finding.service}: ${finding.signature.slice(0, 120)} x${String(finding.count)}`
    )
    .join("\n");
  const data = { batch: batch.length };

  if (parsed.values.dispatch !== true) {
    return ok(
      `${String(batch.length)} finding(s) waiting for triage. Send them with --dispatch:\n${listing}`,
      data
    );
  }

  const result = deps.run(
    "gh",
    [
      "workflow",
      "run",
      "agent-triage.yml",
      "--field",
      `findings=${dispatchInput(batch)}`,
    ],
    { cwd: context.root, timeoutMs: 60_000 }
  );

  return result.status === 0
    ? ok(
        `Sent ${String(batch.length)} finding(s) to the triage workflow:\n${listing}`,
        data
      )
    : failed(`gh workflow run failed: ${result.stderr.trim().slice(0, 300)}`);
};

/** `lanes triage-plan <plan.json> <findings.json> [--pr=<url>] [--proven] [--out=<file>]`. */
export const triagePlanRun = (args: readonly string[]): ICommandOutcome => {
  const parsed = parse(args, {
    pr: { type: "string" },
    proven: { type: "boolean", default: false },
    out: { type: "string" },
  });

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const [planFile = "", findingsFile = ""] = parsed.positionals;
  const findings = parseTriageInput(readText(findingsFile) ?? "");

  if (typeof findings === "string") {
    return failed(findings);
  }

  const plan = readPlan(
    readJson(planFile),
    findings.map((finding) => finding.id)
  );

  if (Array.isArray(plan)) {
    return failed(`The triage plan is not usable:\n${plan.join("\n")}`);
  }

  const prUrl = parsed.values.pr;
  const comment = triageComment(plan, {
    prUrl: typeof prUrl === "string" ? prUrl : undefined,
    proven: parsed.values.proven === true,
  });
  const out = parsed.values.out;

  if (typeof out === "string") {
    writeText(out, `${comment}\n`);
  }

  return ok(comment);
};

/** `lanes cap <lane>`: open `gh pr list` rows on stdin; the decision comes back as data. */
export const capRun = (
  args: readonly string[],
  deps: ILanesDeps
): ICommandOutcome => {
  const lane = laneNamed(args[0]);

  if (lane === undefined) {
    return failed(unknownLane(args[0]));
  }

  const input = deps.stdin();
  const raw: unknown = JSON.parse(input === "" ? "[]" : input);
  const decision = capDecision(lane, parsePrRows(raw), deps.now());

  return ok(
    decision.run
      ? `${String(decision.slots)} PR may be opened in the ${lane} lane (${decision.reason}).`
      : `The ${lane} lane waits (${decision.result}: ${decision.reason}).`,
    decision
  );
};

/**
 * `lanes risk --body=<file> [--reviewed] [--ceiling=<level>] [--out=<file>] < paths`:
 * the PR's risk level and whether an agent may merge it. --reviewed reads the
 * independent reviewer's level from the body's Review section (only after the
 * review lane wrote it there). --out writes `level=` and `merge=` lines for
 * $GITHUB_OUTPUT.
 */
export const riskRun = (
  args: readonly string[],
  deps: ILanesDeps
): ICommandOutcome => {
  const parsed = parse(args, {
    body: { type: "string" },
    reviewed: { type: "boolean" },
    ceiling: { type: "string" },
    out: { type: "string" },
  });

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const { body: bodyFile, reviewed, ceiling, out } = parsed.values;
  const body = typeof bodyFile === "string" ? readText(bodyFile) : undefined;

  if (body === undefined) {
    return failed(
      "Usage: lanes risk --body=<file> [--reviewed] [--ceiling=<level>] [--out=<file>] < paths"
    );
  }

  const decision = decideRisk({
    paths: splitLines(deps.stdin()),
    body,
    review: reviewed === true ? reviewSectionOf(body) : undefined,
    ceiling: ceilingOf(typeof ceiling === "string" ? ceiling : undefined),
  });

  if (typeof out === "string") {
    writeText(
      out,
      `level=${decision.level}\nmerge=${String(decision.merge)}\n`
    );
  }

  return ok(
    [`Risk: ${decision.level}.`, ...decision.reasons].join("\n"),
    decision
  );
};

/** `lanes review-body <body.md> <review.md> <out.md>`: the record with its Review section replaced. */
export const reviewBodyRun = (args: readonly string[]): ICommandOutcome => {
  const [bodyFile = "", reviewFile = "", out = ""] = args;
  const body = readText(bodyFile);
  const review = readText(reviewFile);

  if (body === undefined || review === undefined || out === "") {
    return failed("Usage: lanes review-body <body.md> <review.md> <out.md>");
  }

  writeText(out, replaceReviewSection(body, review));

  return ok(`The Review section is written to ${out}.`);
};

type IGh =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string };

/** A gh call's JSON output, or the reason it failed. */
const gh = (deps: ILanesDeps, args: readonly string[]): IGh => {
  const result = deps.run("gh", args, { timeoutMs: 120_000 });

  if (result.status !== 0) {
    const stderr = result.stderr.trim().slice(0, 300);

    return {
      ok: false,
      error: stderr === "" ? `exit ${String(result.status)}` : stderr,
    };
  }

  try {
    const value: unknown = JSON.parse(result.stdout);

    return { ok: true, value };
  } catch {
    return { ok: false, error: "gh printed no JSON" };
  }
};

/** `lanes digest <out.md> [--now=<iso>]`: the weekly digest, read from GitHub with gh. */
export const digestRun = (
  args: readonly string[],
  deps: ILanesDeps
): ICommandOutcome => {
  const parsed = parse(args, { now: { type: "string" } });

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const [out = ""] = parsed.positionals;

  if (out === "") {
    return failed("Usage: lanes digest <out.md> [--now=<iso>]");
  }

  const named = parsed.values.now;
  const now = typeof named === "string" ? Date.parse(named) : deps.now();

  if (Number.isNaN(now)) {
    return failed(`--now: not a time: ${String(named)}`);
  }

  const prs = gh(deps, [
    "pr",
    "list",
    "--state",
    "all",
    "--limit",
    "200",
    "--json",
    "number,title,url,headRefName,state,mergedAt,closedAt",
  ]);
  const runs = gh(deps, [
    "run",
    "list",
    "--limit",
    "200",
    "--json",
    "name,conclusion,headBranch,createdAt,url",
  ]);

  if (!prs.ok) {
    return failed(`gh pr list failed: ${prs.error}`);
  }

  if (!runs.ok) {
    return failed(`gh run list failed: ${runs.error}`);
  }

  writeText(
    out,
    `${digestMarkdown({
      nowMs: now,
      prs: parsePulls(prs.value),
      runs: parseRuns(runs.value),
    })}\n`
  );

  return ok(`Digest written to ${out}.`);
};

const depsOf = (): ILanesDeps => ({
  run: runProcess,
  now: nowMs,
  stdin: readStdin,
});

/** The lanes commands, registered with the factory CLI. */
export const lanesCommands: readonly IFactoryCommand[] = [
  {
    name: "lanes",
    summary:
      "The agent lanes: what each may change and how many PRs it may have open",
    run: () => Promise.resolve(lanesList()),
  },
  {
    name: "lanes scope",
    summary: "Check a change set (paths on stdin) against a lane",
    usage: "<lane> < paths",
    run: (args) => Promise.resolve(scopeRun(args, depsOf())),
  },
  {
    name: "lanes prove",
    summary: "Prove a fix: its tests fail on HEAD and pass with the change",
    usage: "[--report=<file>] [paths...]",
    run: (args) => Promise.resolve(proveRun(args, depsOf())),
  },
  {
    name: "lanes report",
    summary: "Summarise an agent run's transcript as Markdown",
    usage: "<transcript> <out.md> [--title=...]",
    run: (args) => Promise.resolve(reportRun(args)),
  },
  {
    name: "lanes risk",
    summary:
      "A PR's risk (low, medium, high) from its paths, record and review, and whether an agent may merge it",
    usage:
      "--body=<file> [--reviewed] [--ceiling=<level>] [--out=<file>] < paths",
    run: (args) => Promise.resolve(riskRun(args, depsOf())),
  },
  {
    name: "lanes triage",
    summary:
      "Findings waiting for triage from the ledger; --dispatch sends them to the workflow",
    usage: "[--dispatch]",
    run: (args, context) => Promise.resolve(triageRun(args, context, depsOf())),
  },
  {
    name: "lanes triage-plan",
    summary: "Check a triage plan against its findings and write the comment",
    usage: "<plan.json> <findings.json> [--pr=<url>] [--proven] [--out=<file>]",
    run: (args) => Promise.resolve(triagePlanRun(args)),
  },
  {
    name: "lanes cap",
    summary: "Whether a lane may open another PR (gh pr list rows on stdin)",
    usage: "<lane> < prs.json",
    run: (args) => Promise.resolve(capRun(args, depsOf())),
  },
  {
    name: "lanes review-body",
    summary:
      "Write a reviewer's verdict into the Review section of a PR's record",
    usage: "<body.md> <review.md> <out.md>",
    run: (args) => Promise.resolve(reviewBodyRun(args)),
  },
  {
    name: "lanes digest",
    summary:
      "The weekly agent digest from GitHub (agent PRs and failed agent runs)",
    usage: "<out.md> [--now=<iso>]",
    run: (args) => Promise.resolve(digestRun(args, depsOf())),
  },
];
