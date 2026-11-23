import type { IEmailDeliveryJobData } from "../../queues/email-delivery/email-delivery.types";
import type { ICloudflareSuppression } from "./providers/cloudflare-suppressions";

/** An email the delivery queue already handled, and when it finished. */
export interface IHandledEmail {
  data: IEmailDeliveryJobData;
  finishedAtMs: number;
}

/** Everything the recovery needs from the outside world. */
export interface ISoftBounceRecoveryDeps {
  listSoftBounces: () => Promise<ICloudflareSuppression[]>;
  liftBlock: (id: string) => Promise<void>;
  /** True the first time an address is claimed inside the claim window. */
  claim: (email: string) => Promise<boolean>;
  clearLocalSuppression: (email: string) => Promise<unknown>;
  handledEmails: () => Promise<IHandledEmail[]>;
  resend: (data: IEmailDeliveryJobData, delayMs: number) => Promise<void>;
  nowMs: () => number;
}

export interface ISoftBounceRecoveryResult {
  /** Soft-bounce blocks Cloudflare is holding right now. */
  found: number;
  /** Blocks lifted on this run. */
  lifted: number;
  /** Emails queued to go out again. */
  resent: number;
  /** Addresses whose block could not be lifted or whose emails could not be queued. */
  failed: number;
}
