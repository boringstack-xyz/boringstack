import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { IFactoryContext } from "../context";
import { isRecord, readJson } from "../state";

/*
 * The preview a checkout's slot is running: the slot whose claim names this
 * checkout (slots/s<N>.json), then its preview route (preview/s<N>.json).
 * Undefined when the checkout holds no slot or the slot has no preview.
 */
const slotNames = (sharedDir: string): string[] => {
  try {
    return readdirSync(join(sharedDir, "slots"))
      .filter((name) => /^s\d+\.json$/u.test(name))
      .sort();
  } catch {
    return [];
  }
};

const claimsCheckout = (claim: unknown, root: string): boolean =>
  isRecord(claim) && Object.values(claim).includes(root);

export const previewOf = (context: IFactoryContext): string | undefined => {
  const slot = slotNames(context.sharedDir).find((name) =>
    claimsCheckout(
      readJson(join(context.sharedDir, "slots", name)),
      context.root
    )
  );

  if (slot === undefined) {
    return undefined;
  }

  const route = readJson(join(context.sharedDir, "preview", slot));
  const url = isRecord(route) ? route.url : undefined;

  return typeof url === "string" && /^https?:\/\//u.test(url) ? url : undefined;
};
