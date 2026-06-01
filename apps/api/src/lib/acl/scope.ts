import type { IMembership } from "./acl.types";
import type { IAccountScope } from "./scope.types";

/**
 * Narrows a membership down to the account-scope filter. Use the
 * returned `accountId` as the `WHERE` value for every account-scoped
 * Drizzle query. A future `eslint-plugin-drizzle-conventions/
 * account-scoped-tables-require-where` rule enforces that account-
 * scoped tables always carry such a filter.
 */
export const scopedTo = (membership: IMembership): IAccountScope => ({
  accountId: membership.accountId,
});
