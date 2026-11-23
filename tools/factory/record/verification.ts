import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { nowMs } from "../clock";
import type { IFactoryContext } from "../context";
import { currentBranch, git } from "../git";
import { blocked, failed, type ICommandOutcome, ok } from "../result";
import { readText, slug, writeText } from "../state";
import { draft, notVerifiedItems, problems } from "./verification.utils";
import { describeRun, latestRun } from "./verify";

/* `factory verification new|check|gaps`. */
export const recordsDir = (context: IFactoryContext): string =>
  join(context.stateDir, "verifications");

export const recordFile = (context: IFactoryContext, branch: string): string =>
  join(recordsDir(context), `${slug(branch)}.md`);

export const headOf = (context: IFactoryContext, branch: string): string =>
  git(context.root, ["rev-parse", branch]) ?? "";

/** The issue a factory branch is for: `factory/<issue>`. */
export const issueOfBranch = (branch: string): string | undefined =>
  /^factory\/(.+)$/u.exec(branch)?.[1];

export const recordProblems = (
  context: IFactoryContext,
  branch: string
): string[] => {
  const text = readText(recordFile(context, branch));

  return text === undefined
    ? ["there is no verification record"]
    : problems(text, headOf(context, branch));
};

const branchArg = (args: readonly string[], context: IFactoryContext): string =>
  args.find((arg) => !arg.startsWith("-")) ?? currentBranch(context.root);

export const verificationNew = (
  args: readonly string[],
  context: IFactoryContext
): Promise<ICommandOutcome> => {
  const branch = branchArg(args, context);
  const file = recordFile(context, branch);
  const existing = readText(file);

  if (existing !== undefined && !args.includes("--force")) {
    return Promise.resolve(
      blocked(`${file} already exists; edit it, or pass --force to start over`)
    );
  }

  const run = latestRun(context);
  const head = headOf(context, branch);

  writeText(
    file,
    draft({
      branch,
      commit: head,
      issue: issueOfBranch(branch),
      checks: run?.commit === head ? describeRun(run) : undefined,
    })
  );

  return Promise.resolve(ok(`wrote ${file}; fill in every TODO`));
};

export const verificationCheck = (
  args: readonly string[],
  context: IFactoryContext
): Promise<ICommandOutcome> => {
  const branch = branchArg(args, context);
  const found = recordProblems(context, branch);

  return Promise.resolve(
    found.length === 0
      ? ok(`the verification record of ${branch} is complete`)
      : failed(
          [
            `the verification record of ${branch} is not complete:`,
            ...found.map((item) => `- ${item}`),
          ].join("\n"),
          { problems: found }
        )
  );
};

const DAY_MS = 86_400_000;

const listRecords = (context: IFactoryContext): string[] => {
  try {
    return readdirSync(recordsDir(context)).filter((name) =>
      name.endsWith(".md")
    );
  } catch {
    return [];
  }
};

export const verificationGaps = (
  args: readonly string[],
  context: IFactoryContext
): Promise<ICommandOutcome> => {
  const sinceIndex = args.indexOf("--since");
  const days = Number(sinceIndex >= 0 ? args[sinceIndex + 1] : "7");
  const cutoff = nowMs() - (Number.isFinite(days) ? days : 7) * DAY_MS;
  const files = listRecords(context);

  const gaps = files.flatMap((name) => {
    const path = join(recordsDir(context), name);

    return statSync(path).mtimeMs < cutoff
      ? []
      : notVerifiedItems(readText(path) ?? "").map(
          (item) => `${decodeURIComponent(name.replace(/\.md$/u, ""))}: ${item}`
        );
  });

  return Promise.resolve(
    ok(
      gaps.length === 0
        ? "no 'Not verified' items in recent records"
        : gaps.join("\n"),
      { gaps }
    )
  );
};
