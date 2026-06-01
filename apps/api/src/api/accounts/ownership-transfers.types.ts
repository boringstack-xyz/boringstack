export interface IOwnershipTransfer {
  readonly id: string;
  readonly accountId: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly declinedAt: string | null;
  readonly cancelledAt: string | null;
  readonly createdAt: string;
}

export interface IInitiateOwnershipTransferInput {
  readonly accountId: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly actorUserId: string;
}

export interface IInitiateOwnershipTransferResult {
  readonly transfer: IOwnershipTransfer;
  /** Raw token sent in the email; never persisted, only its hash is. */
  readonly rawToken: string;
}
