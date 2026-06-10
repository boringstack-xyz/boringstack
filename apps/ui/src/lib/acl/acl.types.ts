import type { ForcedSubject, MongoAbility } from "@casl/ability";

import type { ACTIONS, ROLES, SUBJECTS } from "./acl.types.generated";

export { ROLE } from "./acl.types.generated";

export type Role = (typeof ROLES)[number];
export type Action = (typeof ACTIONS)[number];
export type Subject = (typeof SUBJECTS)[number];

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
  | ITeamMemberSubject
  | ISiteSubject
  | IAccountSubject;

export type AppSubject = Subject | SubjectInstance;

export type AppAbility = MongoAbility<[Action, AppSubject]>;
