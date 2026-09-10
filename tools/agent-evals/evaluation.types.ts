import type { ICheckResult } from "../agent/result";
import type { ISandbox } from "../agent/sandbox/lifecycle";

export interface IEvaluationContext {
  root: string;
  dir: string;
  evidenceDir: string;
  candidate: string | undefined;
  env: Record<string, string>;
  results: ICheckResult[];
  sandbox: ISandbox;
}
