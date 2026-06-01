import type { IPublicUserProfile, IUser } from "./users.types";

export const toPublicUserProfile = (user: IUser): IPublicUserProfile => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  emailVerified: user.emailVerifiedAt !== null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
