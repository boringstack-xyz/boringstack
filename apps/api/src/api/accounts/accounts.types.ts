import type { InferSelectModel } from "drizzle-orm";

import type { db } from "../../clients/postgres";
import type {
  accountMemberships,
  accounts,
} from "../../clients/postgres/schema";
import type { Role } from "../../lib/acl/acl.types";

export type IAccount = InferSelectModel<typeof accounts>;
export type IAccountMembership = InferSelectModel<typeof accountMemberships>;

/** Active membership row with the persisted role coerced to `Role`. */
export type ActiveMembership = Omit<IAccountMembership, "role"> & {
  readonly role: Role;
};

export type DbOrTx =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface IProvisionAfterVerificationInput {
  readonly userId: string;
  /**
   * Optional override. Production callers omit this — the name is
   * derived from the user row (firstName/lastName, falling back to
   * email). Tests pin a specific name for readable assertions.
   */
  readonly name?: string;
}

export interface ICreatePersonalAccountResult {
  readonly account: IAccount;
  readonly membership: IAccountMembership;
}

export interface IPersonalAccountNameInput {
  readonly firstName: string | undefined;
  readonly lastName: string | undefined;
  readonly email: string;
}
