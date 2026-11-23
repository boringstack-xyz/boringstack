/*
 * Pure parts of `factory walk`: which files count as walkthroughs, and the
 * list of steps (title and screenshot) the walkthrough fixture writes.
 */
import { isAbsolute, relative, resolve, sep } from "node:path";

/** Walkthroughs live here, relative to the checkout: apps/ui/e2e/walkthroughs. */
export const WALKTHROUGH_DIR = "apps/ui/e2e/walkthroughs";

/** The suffix that makes a spec a walkthrough (not run by the normal e2e suite). */
export const WALKTHROUGH_SUFFIX = ".walk.ts";

export interface IWalkStep {
  readonly index: number;
  readonly title: string;
  /** The screenshot's file name inside the run's folder. */
  readonly screenshot: string;
}

/**
 * The scenario file as an absolute path, or the reason it cannot be walked:
 * it must be a `*.walk.ts` file inside the walkthroughs folder.
 */
export const scenarioOf = (
  root: string,
  input: string
): { readonly path: string } | { readonly error: string } => {
  const path = resolve(root, input);
  const inside = relative(resolve(root, WALKTHROUGH_DIR), path);

  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
    return { error: `a walkthrough lives in ${WALKTHROUGH_DIR}/` };
  }

  if (!path.endsWith(WALKTHROUGH_SUFFIX)) {
    return { error: `a walkthrough file ends in ${WALKTHROUGH_SUFFIX}` };
  }

  return { path };
};

/** The scenario's path relative to the app, as Playwright takes it on its command line. */
export const scenarioArgOf = (uiRoot: string, absolute: string): string =>
  relative(uiRoot, absolute).split(sep).join("/");

/** Steps written by the walkthrough fixture; anything that does not read is dropped. */
export const parseSteps = (body: unknown): IWalkStep[] => {
  if (!Array.isArray(body)) {
    return [];
  }

  return body.flatMap((entry: unknown): IWalkStep[] => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("index" in entry) ||
      !("title" in entry) ||
      !("screenshot" in entry) ||
      typeof entry.index !== "number" ||
      typeof entry.title !== "string" ||
      typeof entry.screenshot !== "string"
    ) {
      return [];
    }

    return [
      { index: entry.index, title: entry.title, screenshot: entry.screenshot },
    ];
  });
};

/** The list for a verification record's "Walked in browser" section. */
export const walkedLines = (
  steps: readonly IWalkStep[],
  folder: string
): string[] =>
  steps.map(
    (step) =>
      `  ${String(step.index)}. ${step.title}: ${folder}/${step.screenshot}`
  );
