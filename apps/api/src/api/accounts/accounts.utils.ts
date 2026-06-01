import { coerceRole } from "../../lib/acl/role-coercion";

import type {
  ActiveMembership,
  IAccountMembership,
  IPersonalAccountNameInput,
} from "./accounts.types";

export const toActiveMembership = (
  row: IAccountMembership
): ActiveMembership => ({
  ...row,
  role: coerceRole(row.role),
});

export const buildPersonalAccountName = (
  input: IPersonalAccountNameInput
): string => {
  const fullName = `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim();

  if (fullName === "") {
    return input.email;
  }

  return fullName;
};
