import { sendTemplate } from "../../lib/email";

import {
  OWNERSHIP_TRANSFER_EMAIL_SUBJECT,
  OWNERSHIP_TRANSFER_TEMPLATE_PATH,
  OWNERSHIP_TRANSFER_TTL_MS,
} from "./ownership-transfers.constants";
import type { IOwnershipTransfer } from "./ownership-transfers.types";

import type { accountOwnershipTransfers } from "../../clients/postgres/schema";

interface IDispatchOwnershipTransferEmailInput {
  readonly toEmail: string;
  readonly accountName: string;
  readonly fromUserEmail: string;
  readonly rawToken: string;
  readonly acceptUrl: string;
  readonly expiresAt: string;
  readonly transferId: string;
}

export const dispatchOwnershipTransferEmail = async (
  input: IDispatchOwnershipTransferEmailInput
): Promise<void> => {
  await sendTemplate({
    to: input.toEmail,
    subject: OWNERSHIP_TRANSFER_EMAIL_SUBJECT,
    templatePath: OWNERSHIP_TRANSFER_TEMPLATE_PATH,
    variables: {
      preHeader: "Review an ownership transfer offer",
      accountName: input.accountName,
      fromUserEmail: input.fromUserEmail,
      acceptUrl: `${input.acceptUrl}?token=${input.rawToken}`,
      expiresAt: input.expiresAt,
      transferId: input.transferId,
    },
  });
};

export const computeOwnershipTransferExpiresAt = (): string =>
  new Date(Date.now() + OWNERSHIP_TRANSFER_TTL_MS).toISOString();

export const isLiveOwnershipTransfer = (
  row: typeof accountOwnershipTransfers.$inferSelect
): boolean =>
  row.acceptedAt === null &&
  row.declinedAt === null &&
  row.cancelledAt === null;

export const toOwnershipTransfer = (
  row: typeof accountOwnershipTransfers.$inferSelect
): IOwnershipTransfer => ({
  id: row.id,
  accountId: row.accountId,
  fromUserId: row.fromUserId,
  toUserId: row.toUserId,
  expiresAt: row.expiresAt,
  acceptedAt: row.acceptedAt,
  declinedAt: row.declinedAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
});
