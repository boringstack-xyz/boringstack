import { Elysia } from "elysia";

import { REFRESH_COOKIE_NAME } from "../../lib/cookies";
import { ApiErrors } from "../../lib/errors";
import { errorHandler } from "../../middleware/error-handler";
import { requireAuth, tryAuth } from "../auth/auth.plugin";

import {
  MeResponse,
  UpdateUserProfileSchema,
  UserProfileResponse,
} from "./users.schemas";
import { usersService } from "./users.service";

/*
 * GET /me is a probe: every anonymous boot of the SPA hits it. It
 * uses `tryAuth` so a missing cookie resolves to `{ user: null }`
 * (200) rather than a noisy 401. A cookie that's present but invalid
 * still throws and surfaces as 401 `invalid_session`, which the UI
 * treats as a forced logout.
 *
 * The access cookie is short-lived (15 minutes) and the browser drops
 * it on expiry, so "no access cookie" is not proof of anonymity: a
 * refresh cookie that is still present means the session can be renewed.
 * That case must be a 401, which makes the client refresh and retry,
 * rather than a 200 `{ user: null }` that would sign the user out on reload.
 */
const meRoutes = tryAuth()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/me",
    async ({ user, accountId, cookie }) => {
      if (user !== null && accountId !== null) {
        return usersService.getMe(user.id, accountId);
      }

      const refresh = cookie[REFRESH_COOKIE_NAME]?.value;

      if (typeof refresh === "string" && refresh !== "") {
        throw ApiErrors.unauthorized("The session needs refreshing");
      }

      return { user: null };
    },
    {
      response: MeResponse,
      detail: {
        tags: ["Users"],
        summary:
          "Get the current user, active account, memberships, and resolved features. Returns `{ user: null }` for anonymous callers.",
      },
    }
  );

const userMutationRoutes = requireAuth()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
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

const usersRoutes = new Elysia().use(meRoutes).use(userMutationRoutes);

export default usersRoutes;
