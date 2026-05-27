export type JoinRequestStatus = "pending" | "approved" | "denied";

export interface IJoinRequest {
  readonly id: string;
  readonly accountId: string;
  readonly userId: string;
  readonly email: string;
  readonly status: JoinRequestStatus;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly decidedByUserId: string | null;
}

export interface ICreateJoinRequestInput {
  readonly accountId: string;
  readonly userId: string;
  readonly email: string;
}
