import { env } from "../env";
import { logger } from "./logger";

/** Logs the startup banner. Called once from `src/index.ts` after Elysia binds. */
export const logStartup = (hostname: string, port: number): void => {
  logger.info(`API is running at ${hostname}:${String(port)}`, {
    event: "server.started",
    hostname,
    port,
  });

  if (env.isDevelopment) {
    logger.info(`Swagger UI available at ${hostname}:${String(port)}/swagger`, {
      event: "server.swagger_available",
      hostname,
      port,
    });
  }
};
