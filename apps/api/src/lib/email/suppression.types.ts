import type {
  EmailSuppressionProvider,
  EmailSuppressionReason,
} from "./suppression.constants";

export interface IRecordSuppressionInput {
  email: string;
  reason: EmailSuppressionReason;
  provider: EmailSuppressionProvider;
  providerMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface IRecordSuppressionResult {
  /** True when a fresh row was inserted; false when the address was already suppressed. */
  recorded: boolean;
}

export interface IEmailSuppressionEntry {
  email: string;
  reason: EmailSuppressionReason;
  provider: EmailSuppressionProvider;
  providerMessageId: string | null;
  suppressedAt: string;
}
