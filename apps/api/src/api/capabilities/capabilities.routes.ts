import { Elysia } from "elysia";

import { CapabilitiesResponseSchema } from "./capabilities.schemas";
import { capabilitiesService } from "./capabilities.service";

const CACHE_CONTROL = "public, max-age=60";

const capabilitiesRoutes = new Elysia().get(
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
