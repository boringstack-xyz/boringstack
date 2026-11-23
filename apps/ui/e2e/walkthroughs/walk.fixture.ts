/*
 * What walkthroughs import instead of `@playwright/test`. `walk` runs a step
 * and then takes a screenshot of the page, recording each step in
 * steps.json in the run's folder (FACTORY_WALK_DIR, set by `factory walk`).
 * The factory prints that list for the verification record.
 *
 *   test("…", async ({ page, walk }) => {
 *     await walk.step("Open the page", async () => {
 *       await page.goto("/dashboard");
 *     });
 *   });
 */
import { test as base, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface IWalkStepRecord {
  readonly index: number;
  readonly title: string;
  /** File name inside the run's folder. */
  readonly screenshot: string;
}

export interface IWalk {
  /** Runs `body` as a named step, then screenshots the page; a failed step is screenshotted too. */
  readonly step: (title: string, body: () => Promise<void>) => Promise<void>;
}

/** A title as a file name: `Open the sign-up page` → `open-the-sign-up-page`. */
export const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60);

export const test = base.extend<{ walk: IWalk }>({
  walk: async ({ page }, use, testInfo) => {
    const folder =
      process.env.FACTORY_WALK_DIR ?? join(testInfo.outputDir, "walk");
    const steps: IWalkStepRecord[] = [];

    mkdirSync(folder, { recursive: true });

    const record = async (title: string, failed: boolean): Promise<void> => {
      const index = steps.length + 1;
      const screenshot = `${String(index).padStart(2, "0")}-${slugOf(title)}${failed ? "-failed" : ""}.png`;

      await page.screenshot({ path: join(folder, screenshot), fullPage: true });
      steps.push({
        index,
        title: failed ? `${title} (failed)` : title,
        screenshot
      });
      writeFileSync(
        join(folder, "steps.json"),
        `${JSON.stringify(steps, null, 2)}\n`
      );
    };

    await use({
      step: (title, body) =>
        base.step(title, async () => {
          try {
            await body();
          } catch (error: unknown) {
            await record(title, true);

            throw error;
          }

          await record(title, false);
        })
    });
  }
});

export { expect };
