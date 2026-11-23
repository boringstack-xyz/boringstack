/*
 * Every factory command ends in one of three states, the same contract as
 * agent:verify: 0 done, 1 failed (a check said no), 2 blocked (a person or a
 * missing prerequisite must act). "Blocked" is never a pass.
 */
export const EXIT = { ok: 0, failed: 1, blocked: 2 } as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export interface ICommandOutcome {
  readonly code: ExitCode;
  /** One-line, plain-language summary for people. */
  readonly summary: string;
  /** Machine-readable payload printed with --json. */
  readonly data?: unknown;
}

export const ok = (summary: string, data?: unknown): ICommandOutcome => ({
  code: EXIT.ok,
  summary,
  data,
});

export const failed = (summary: string, data?: unknown): ICommandOutcome => ({
  code: EXIT.failed,
  summary,
  data,
});

export const blocked = (summary: string, data?: unknown): ICommandOutcome => ({
  code: EXIT.blocked,
  summary,
  data,
});
