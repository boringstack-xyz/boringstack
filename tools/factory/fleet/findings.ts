/*
 * `factory findings [--since 24h] [--file]`: the error records of every
 * factory stack on this machine, grouped into findings and merged into the
 * ledger <shared>/findings.json. Muted findings (reasoned, in
 * tools/factory/expected-log-findings.json) are kept but never filed.
 * Without --file it only updates the ledger and lists what has no issue yet.
 */
import { join } from "node:path";
import { parseArgs } from "node:util";

import { nowMs } from "../clock";
import type { IFactoryContext } from "../context";
import { blocked, failed, ok, type ICommandOutcome } from "../result";
import { listStackContainers } from "./docker";
import { githubIssueFiler, type IIssueFiler } from "./findings.file";
import {
  compileRules,
  type ICompiledRule,
  type IFinding,
  type ILedger,
  mergeLedger,
  parseExpectedFile,
  parseLedger,
  scanFindings,
  unfiledFindings,
} from "./findings.utils";
import { readRecords } from "./logs.read";
import { sinceTime } from "./logs.utils";
import { type ProcessRunner, runProcess } from "./process";
import { readJson, writeJson } from "../state";

/** New issues one run may file: a noisy new error waits for the next run rather than flooding the tracker. */
export const MAX_NEW_ISSUES = 10;

export interface IFindingsDeps {
  readonly run: ProcessRunner;
  readonly filer: IIssueFiler;
  readonly now: () => number;
}

export const expectedPathOf = (root: string): string =>
  join(root, "tools", "factory", "expected-log-findings.json");

export const ledgerPathOf = (sharedDir: string): string =>
  join(sharedDir, "findings.json");

interface IFindingsArgs {
  readonly since: string;
  readonly file: boolean;
}

const parseFindingsArgs = (args: readonly string[]): IFindingsArgs | string => {
  try {
    const { values } = parseArgs({
      args: [...args],
      strict: true,
      allowPositionals: false,
      options: {
        since: { type: "string", default: "24h" },
        file: { type: "boolean", default: false },
      },
    });

    return { since: values.since, file: values.file };
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

const describe = (finding: IFinding): string =>
  `${finding.service}${finding.event === null ? "" : ` (${finding.event})`}: ${finding.signature.slice(0, 120)} x${String(finding.count)}`;

/** Files up to MAX_NEW_ISSUES unfiled findings, saving the ledger after each one filed. */
const fileNew = async (
  ledger: ILedger,
  filer: IIssueFiler,
  save: (next: ILedger) => void
): Promise<{ ledger: ILedger; filed: IFinding[]; error: string | null }> => {
  let current = ledger;
  const filed: IFinding[] = [];

  for (const finding of unfiledFindings(ledger).slice(0, MAX_NEW_ISSUES)) {
    try {
      const issue = await filer.file(finding);

      current = {
        ...current,
        findings: current.findings.map((known) =>
          known.id === finding.id ? { ...known, filed: issue } : known
        ),
      };
      save(current);
      filed.push(finding);
    } catch (error: unknown) {
      return {
        ledger: current,
        filed,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { ledger: current, filed, error: null };
};

export const findingsRun = async (
  args: readonly string[],
  context: IFactoryContext,
  deps: IFindingsDeps
): Promise<ICommandOutcome> => {
  const parsed = parseFindingsArgs(args);

  if (typeof parsed === "string") {
    return failed(parsed);
  }

  const since = sinceTime(parsed.since, deps.now());

  if (since === null) {
    return failed(`--since: not a time: ${parsed.since}`);
  }

  const expectedRaw = readJson(expectedPathOf(context.root));
  let rules: ICompiledRule[];

  try {
    rules = compileRules(parseExpectedFile(expectedRaw));
  } catch (error: unknown) {
    return blocked(
      `The expected-findings file is not usable: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const containers = listStackContainers(deps.run, context.config.project);

  if (containers === null) {
    return blocked("Docker cannot be reached, so the findings cannot be read.");
  }

  if (containers.length === 0) {
    return ok(
      "No factory stacks are running, so there are no findings to read.",
      {
        added: 0,
        unfiled: 0,
      }
    );
  }

  const records = readRecords(deps.run, containers, since);
  const ledgerPath = ledgerPathOf(context.sharedDir);
  const scanned = scanFindings(records, rules);
  const merged = mergeLedger(parseLedger(readJson(ledgerPath)), scanned);

  writeJson(ledgerPath, merged);

  const filing = parsed.file
    ? await fileNew(merged, deps.filer, (next) => {
        writeJson(ledgerPath, next);
      })
    : { ledger: merged, filed: [], error: null };

  writeJson(ledgerPath, filing.ledger);

  const unfiled = unfiledFindings(filing.ledger);
  const muted = filing.ledger.findings.filter(
    (finding) => finding.muted
  ).length;
  const lines = [
    `${String(scanned.length)} error group(s) in the last ${parsed.since} across ${String(containers.length)} container(s); ${String(muted)} muted, ${String(unfiled.length)} without an issue.`,
    ...unfiled.slice(0, 10).map((finding) => `  ${describe(finding)}`),
  ];
  const data = {
    ledger: ledgerPath,
    scanned: scanned.length,
    filed: filing.filed.map((finding) => finding.id),
    unfiled: unfiled.length,
  };

  return filing.error !== null
    ? failed(`${lines.join("\n")}\nFiling stopped: ${filing.error}`, data)
    : ok(lines.join("\n"), data);
};

export const findingsCommand = (
  args: readonly string[],
  context: IFactoryContext
): Promise<ICommandOutcome> =>
  findingsRun(args, context, {
    run: runProcess,
    filer: githubIssueFiler(runProcess, context.root),
    now: nowMs,
  });
