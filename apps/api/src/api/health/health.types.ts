export type ReadinessStatus = "ok" | "degraded" | "down";

export interface IReadinessResult {
  name: string;
  status: ReadinessStatus;
  latencyMs: number;
  message?: string;
}

export interface IReadinessCheck {
  name: string;
  /** Run the check; never throws — failure is encoded as `status: "down"`. */
  run: () => Promise<IReadinessResult>;
}

export interface IReadinessReport {
  status: ReadinessStatus;
  timestamp: string;
  checks: IReadinessResult[];
}

export interface IReadinessOutcome {
  report: IReadinessReport;
  isFatal: boolean;
}
