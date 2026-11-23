import type { LIFECYCLE_STAGES } from "./lifecycle.constants";

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/** One person due a follow-up email, with what the email needs to say. */
export interface ILifecycleCandidate {
  userId: string;
  firstName: string;
}

export interface ILifecycleSweepResult {
  sent: Record<LifecycleStage, number>;
}
