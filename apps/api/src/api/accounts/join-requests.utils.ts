import type { accountJoinRequests } from "../../clients/postgres/schema";
import { sendTemplate } from "../../lib/email";

import {
  JOIN_REQUEST_EMAIL_SUBJECT,
  JOIN_REQUEST_STATUS,
  JOIN_REQUEST_TEMPLATE_PATH,
} from "./join-requests.constants";
import type { IJoinRequest, JoinRequestStatus } from "./join-requests.types";

interface IDispatchJoinRequestEmailInput {
  readonly toEmail: string;
  readonly accountName: string;
  readonly reviewUrl: string;
  readonly requestId: string;
}

/**
 * Sends the owner the "someone wants in" notification. Awaited by the
 * service inside a catch-all so a delivery failure cannot mask the
 * DB insert; logging happens at the service layer.
 */
export const dispatchJoinRequestCreatedEmail = async (
  input: IDispatchJoinRequestEmailInput
): Promise<void> => {
  await sendTemplate({
    to: input.toEmail,
    subject: JOIN_REQUEST_EMAIL_SUBJECT,
    templatePath: JOIN_REQUEST_TEMPLATE_PATH,
    variables: {
      preHeader: "A user is requesting to join your account",
      accountName: input.accountName,
      reviewUrl: input.reviewUrl,
      requestId: input.requestId,
    },
  });
};

const parseStatus = (value: string): JoinRequestStatus => {
  if (
    value === JOIN_REQUEST_STATUS.pending ||
    value === JOIN_REQUEST_STATUS.approved ||
    value === JOIN_REQUEST_STATUS.denied
  ) {
    return value;
  }

  return JOIN_REQUEST_STATUS.pending;
};

export const toJoinRequest = (
  row: typeof accountJoinRequests.$inferSelect
): IJoinRequest => ({
  id: row.id,
  accountId: row.accountId,
  userId: row.userId,
  email: row.email,
  status: parseStatus(row.status),
  createdAt: row.createdAt,
  decidedAt: row.decidedAt,
  decidedByUserId: row.decidedByUserId,
});
