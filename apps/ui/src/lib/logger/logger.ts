import type { ILogger } from "./logger.types";
import { emit } from "./logger.utils";

export const logger: ILogger = {
  debug: (payload) => {
    emit("debug", payload);
  },
  info: (payload) => {
    emit("info", payload);
  },
  warn: (payload) => {
    emit("warn", payload);
  },
  error: (payload) => {
    emit("error", payload);
  }
};
