import { ROLE, ROLES } from "./acl.constants";
import type { Role } from "./acl.types";
import { ApiErrors } from "../errors";

export const isRole = (raw: string): raw is Role => {
  for (const role of ROLES) {
    if (role === raw) {
      return true;
    }
  }

  return false;
};

export const isOwnerRole = (role: Role): boolean => role === ROLE.owner;

export const isAdminRole = (role: Role): boolean => role === ROLE.admin;

export const coerceRole = (raw: string): Role => {
  if (!isRole(raw)) {
    throw ApiErrors.internal(`Unknown membership role: ${raw}`);
  }

  return raw;
};
