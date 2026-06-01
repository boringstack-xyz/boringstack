export type MetaRuleCategory =
  | "supply-chain"
  | "ci"
  | "env"
  | "artifacts"
  | "source-text"
  | "testing"
  | "config";

export interface IViolation {
  readonly file: string;
  readonly rule: string;
  readonly message: string;
}

export interface IMetaContext {
  readonly root: string;
  readonly sourceFiles: readonly string[];
  readonly workflowFiles: readonly string[];
}

export interface IMetaRule {
  readonly id: string;
  readonly category: MetaRuleCategory;
  readonly description: string;
  readonly ciCritical?: boolean;
  run(ctx: IMetaContext): IViolation[];
  runAsync?: (ctx: IMetaContext) => Promise<IViolation[]>;
}

/** @deprecated Use IViolation from lint-meta/types */
export type IGuardrailViolation = IViolation;
