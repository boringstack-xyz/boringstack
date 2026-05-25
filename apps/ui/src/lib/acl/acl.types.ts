import type { ForcedSubject, MongoAbility } from "@casl/ability";

import type {
  ACTIONS,
  FEATURES,
  FEATURE_KEYS,
  ROLES,
  SUBJECTS
} from "./acl.types.generated";

export { ROLE } from "./acl.types.generated";

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

export type AppSubject = Subject | SubjectInstance;

export type AppAbility = MongoAbility<[Action, AppSubject]>;
