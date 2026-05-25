import { createAuthMiddleware } from "../auth/auth.plugin";
import { errorHandler } from "../../middleware/error-handler";

import {
  MeResponse,
  UpdateUserProfileSchema,
  UserProfileResponse,
} from "./users.schemas";
import { usersService } from "./users.service";

const usersRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/me",
    async ({ user, accountId }) => usersService.getMe(user.id, accountId),
    {
      response: MeResponse,
      detail: {
        tags: ["Users"],
        summary:
          "Get the current user, active account, memberships, and resolved features",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .patch(
    "/me",
    async ({ body, user }) => usersService.updateProfile(user.id, body),
    {
      body: UpdateUserProfileSchema,
      response: UserProfileResponse,
      detail: {
        tags: ["Users"],
        summary: "Update current user profile",
        security: [{ cookieAuth: [] }],
      },
    }
  );

export default usersRoutes;
