import { Elysia } from "elysia";

import { errorHandler } from "../../middleware/error-handler";

import { CapabilitiesResponseSchema } from "./capabilities.schemas";
import { capabilitiesService } from "./capabilities.service";

const CACHE_CONTROL = "public, max-age=60";

const capabilitiesRoutes = new Elysia()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/",
    ({ set }) => {
      set.headers["cache-control"] = CACHE_CONTROL;

      return capabilitiesService.get();
    },
    {
      response: CapabilitiesResponseSchema,
      detail: {
        tags: ["Capabilities"],
        summary: "Runtime feature and OAuth provider capabilities",
      },
    }
  );

export default capabilitiesRoutes;
