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
   * Optional override. Production callers omit this: the name is
   * derived from the user row (firstName/lastName, falling back to
   * email). Tests pin a specific name for readable assertions.
   */
  readonly name?: string;
}

export interface ICreatePersonalAccountResult {
  readonly account: IAccount;
  readonly membership: IAccountMembership;
}

/**
 * Outcome of `provisionAfterVerification`.
 *
 * A discriminated result rather than an exception for the claimed-domain
 * case, because the two are not equivalent here. The claimed branch files a
 * pending join request so the existing owner can approve the newcomer, and
 * that insert shares the caller's transaction: a throw would abort it, and
 * the row the API promises the user ("an owner will review your request")
 * would not survive the response.
 *
 * Callers turn `domain_claimed` into the user-facing error themselves, once
 * their transaction has committed.
 */
/** What `resolveDomainClaim` found, without deciding what to do about it. */
export type IDomainClaimResolution =
  | { readonly kind: "open"; readonly domain: string | null }
  | {
      readonly kind: "claimed";
      readonly accountId: string;
      readonly accountName: string;
      readonly domain: string;
      readonly joinRequestId: string;
    };

export type IProvisionOutcome =
  | ({ readonly kind: "provisioned" } & ICreatePersonalAccountResult)
  | {
      readonly kind: "domain_claimed";
      readonly accountId: string;
      readonly accountName: string;
      readonly domain: string;
      readonly joinRequestId: string;
    };

export interface IPersonalAccountNameInput {
  readonly firstName: string | undefined;
  readonly lastName: string | undefined;
  readonly email: string;
}
