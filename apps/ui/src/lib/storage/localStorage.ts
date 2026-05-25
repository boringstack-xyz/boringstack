import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import { namespacedKey } from "./localStorage.utils";

export const localStore = {
  get(name: string): unknown {
    try {
      const raw = window.localStorage.getItem(namespacedKey(name));

      if (raw === null) {
        return null;
      }

      return JSON.parse(raw);
    } catch (error) {
      logger.warn({
        event: "storage.get_failed",
        name,
        error: getErrorMessage(error)
      });

      return null;
    }
  },
  set(name: string, value: unknown): void {
    try {
      window.localStorage.setItem(namespacedKey(name), JSON.stringify(value));
    } catch (error) {
      logger.warn({
        event: "storage.set_failed",
        name,
        error: getErrorMessage(error)
      });
    }
  },
  remove(name: string): void {
    window.localStorage.removeItem(namespacedKey(name));
  },
  clear(): void {
    const prefix = namespacedKey("");
    const toRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);

      if (k?.startsWith(prefix) === true) {
        toRemove.push(k);
      }
    }

    for (const k of toRemove) {
      window.localStorage.removeItem(k);
    }
  }
};
