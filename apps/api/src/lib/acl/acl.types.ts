import type { ForcedSubject, MongoAbility } from "@casl/ability";

import type {
  ACTIONS,
  FEATURE_KEYS,
  FEATURES,
  ROLES,
  SUBJECTS,
} from "./acl.constants";

export type Role = (typeof ROLES)[number];
export type Action = (typeof ACTIONS)[number];
export type Subject = (typeof SUBJECTS)[number];
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface IFeatureDef {
  readonly kind: "boolean" | "limit";
  readonly default: boolean | number;
}

export type FeatureValue<K extends FeatureKey> =
  (typeof FEATURES)[K]["kind"] extends "boolean" ? boolean : number;

export interface IMembership {
  readonly userId: string;
  readonly accountId: string;
  readonly role: Role;
}

/*
 * Per-subject field shapes. CASL's MongoQuery is derived from these,
 * so role rules can carry conditions like `{ accountId }` and
 * `{ id }`. Adding a new account-scoped subject means adding both
 * the SUBJECTS constant entry AND a tagged interface here.
 */
export interface IWidgetSubject extends ForcedSubject<"Widget"> {
  readonly accountId: string;
}

export interface ITeamMemberSubject extends ForcedSubject<"TeamMember"> {
  readonly accountId: string;
}

export interface ISiteSubject extends ForcedSubject<"Site"> {
  readonly accountId: string;
}

export interface IAccountSubject extends ForcedSubject<"Account"> {
  readonly id: string;
}

export type SubjectInstance =
  | IWidgetSubject
  | ITeamMemberSubject
  | ISiteSubject
  | IAccountSubject;

/*
 * CASL's `subject(name, obj)` helper returns `obj & ForcedSubject<name>`
 * at compile time. Widening the second slot of the MongoAbility tuple
 * to include both the string-literal Subject and the tagged interfaces
 * lets `ability.can("read", subject("Widget", { ... }))` typecheck
 * alongside `ability.can("read", "Widget")`.
 */
export type AppSubject = Subject | SubjectInstance;

export type AppAbility = MongoAbility<[Action, AppSubject]>;
