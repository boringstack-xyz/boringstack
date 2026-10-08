import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { identifyCheckout } from "./checkout";
import {
  inventoryChange,
  inventoryReview,
  type IInventoryChange,
  type IInventoryReview,
} from "./inventory-review";
import type { IInventory, InventoryLane } from "./inventory.types";
import type { ICheckResult } from "./result";
import { isRecord, isStringArray, parseRecord } from "./validation";

export const LANES = ["api.tests", "ui.tests", "ui.e2e"] as const;
export type Lane = InventoryLane;

/** Reasons a lane check carries; the last two are settled after every lane has finished. */
export const INVENTORY_REASONS = {
  empty: "test_inventory_empty",
  disagrees: "test_inventory_disagrees",
  additions: "test_inventory_additions_recorded",
  updateFailed: "test_inventory_update_failed",
} as const;

export function isInventoryLane(value: string): value is InventoryLane {
  const names: readonly string[] = LANES;

  return names.includes(value);
}

function readAttribute(attributes: string, name: string): string {
  const attributePattern = new RegExp(`(?:^|\\s)${name}="([^"]*)"`);

  return attributePattern.exec(attributes)?.[1] ?? "";
}

/** Keep duplicate identities: losing one repeated case must change the inventory. */
export function identities(xml: string, root: string): string[] {
  const structuralXml = xml.replace(
    /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g,
    " "
  );
  const matches = structuralXml.matchAll(/<testcase\b([^>]*?)(?:\/?>)/g);
  const cases: string[] = [];

  for (const match of matches) {
    const attributes = match[1];

    if (attributes === undefined) {
      throw new Error("Test case has no attributes");
    }

    const file = readAttribute(attributes, "file");
    const source = file === "" ? readAttribute(attributes, "classname") : file;
    const relativeFile = source.replaceAll(`${root}/`, "");
    const name = readAttribute(attributes, "name");

    cases.push(JSON.stringify([relativeFile, name]));
  }

  return cases.sort();
}

export function compareInventory(
  expected: string[],
  actual: string[]
): boolean {
  const sortedExpected = [...expected].sort();
  const sortedActual = [...actual].sort();

  return (
    expected.length > 0 &&
    JSON.stringify(sortedExpected) === JSON.stringify(sortedActual)
  );
}

export function readInventory(path: string): IInventory {
  const value = parseRecord(readFileSync(path, "utf8"));

  if (
    value.schemaVersion !== 1 ||
    !isStringArray(value.cases) ||
    value.cases.length === 0
  ) {
    throw new Error("Invalid or empty test inventory");
  }

  return { schemaVersion: 1, cases: value.cases };
}

function assertSafePath(path: string): void {
  if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
    throw new Error("Unsafe inventory or observation path");
  }
}

function baselinePath(root: string, lane: InventoryLane): string {
  return join(root, "tools/agent/inventories", `${lane}.json`);
}

/** Returns false when the observation is not bound to the checkout that produced it. */
function recordObservation(
  root: string,
  lane: InventoryLane,
  cases: string[],
  expectedFingerprint?: string
): boolean {
  const checkout = identifyCheckout(root);

  if (expectedFingerprint !== checkout.fingerprint) {
    return false;
  }

  const directory = join(root, ".agent-state/observed-tests");
  const path = join(directory, `${lane}.json`);

  assertSafePath(directory);
  assertSafePath(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, checkout, cases }), {
    mode: 0o600,
  });

  return true;
}

/**
 * Classifies one lane's observed cases against its committed baseline.
 * Additions alone pass and are written by settleInventories once the run is stable.
 * Removals and empty observations block; removals are never recorded automatically.
 */
export function inventoryEvidence(
  root: string,
  lane: InventoryLane,
  xml: string,
  evidence: ICheckResult,
  expectedFingerprint?: string
): ICheckResult {
  const actual = identities(xml, root);
  const recorded =
    evidence.status === "passed" &&
    recordObservation(root, lane, actual, expectedFingerprint);

  if (evidence.status === "blocked") {
    return evidence;
  }

  if (actual.length === 0) {
    return { ...evidence, status: "blocked", reason: INVENTORY_REASONS.empty };
  }

  try {
    const expected = readInventory(baselinePath(root, lane));

    if (compareInventory(expected.cases, actual)) {
      return evidence;
    }

    const change = inventoryChange(lane, expected.cases, actual);

    if (recorded && change.removed.length === 0) {
      return {
        ...evidence,
        reason: INVENTORY_REASONS.additions,
      };
    }
  } catch {
    // Missing or malformed expectations cannot establish complete execution.
  }

  return {
    ...evidence,
    status: "blocked",
    reason: INVENTORY_REASONS.disagrees,
  };
}

function readFreshObservation(
  root: string,
  lane: InventoryLane,
  fingerprint: string
): IInventory {
  const directory = join(root, ".agent-state/observed-tests");
  const path = join(directory, `${lane}.json`);

  assertSafePath(directory);
  assertSafePath(path);

  const value = parseRecord(readFileSync(path, "utf8"));

  if (!isRecord(value.checkout) || value.checkout.fingerprint !== fingerprint) {
    throw new Error(
      "Observation is stale or incomplete; run verification again"
    );
  }

  return readInventory(path);
}

/** Preview exact additions and removals without changing the committed baseline. */
export function reviewInventories(
  root: string,
  lanes: readonly InventoryLane[]
): IInventoryReview {
  const checkout = identifyCheckout(root);

  assertSafePath(join(root, "tools/agent/inventories"));

  const changes = lanes.map((lane) => {
    const observation = readFreshObservation(root, lane, checkout.fingerprint);
    const path = join(root, "tools/agent/inventories", `${lane}.json`);

    if (existsSync(path)) {
      assertSafePath(path);
    }

    const before = existsSync(path) ? readInventory(path).cases : [];

    return inventoryChange(lane, before, observation.cases);
  });

  return inventoryReview(checkout.fingerprint, changes);
}

/** Approvals bind the exact checkout and case diff; removals require a second explicit acknowledgement. */
export function acceptInventories(
  root: string,
  lanes: readonly InventoryLane[],
  token: string,
  removalToken?: string
): void {
  const review = reviewInventories(root, lanes);

  if (token !== review.token) {
    throw new Error(
      "Inventory review changed; preview and approve the current diff"
    );
  }

  if (
    review.changes.some((change) => change.removed.length > 0) &&
    removalToken !== review.token
  ) {
    throw new Error("Test removals require --allow-removals=<review token>");
  }

  writeBaselines(root, review.changes);
}

/** The exact command an operator runs to acknowledge a reviewed diff. */
export function acknowledgeCommand(
  lanes: readonly InventoryLane[],
  review: IInventoryReview
): string {
  const removals = review.changes.some((change) => change.removed.length > 0);

  return `bun run agent:inventory -- ${lanes.join(" ")} --accept=${review.token}${removals ? ` --allow-removals=${review.token}` : ""}`;
}

function writeBaselines(
  root: string,
  changes: readonly IInventoryChange[]
): void {
  const directory = join(root, "tools/agent/inventories");

  assertSafePath(directory);

  for (const change of changes) {
    assertSafePath(baselinePath(root, change.lane));
  }

  mkdirSync(directory, { recursive: true });

  for (const change of changes) {
    writeFileSync(
      baselinePath(root, change.lane),
      `${JSON.stringify({ schemaVersion: 1, cases: change.after }, null, 2)}\n`
    );
  }
}

/** Writes additions-only baselines from observations bound to the run's fingerprint. */
function recordAdditions(
  root: string,
  lanes: readonly InventoryLane[],
  fingerprint: string
): void {
  const changes = lanes.map((lane) => {
    const observation = readFreshObservation(root, lane, fingerprint);
    const change = inventoryChange(
      lane,
      readInventory(baselinePath(root, lane)).cases,
      observation.cases
    );

    if (change.removed.length > 0 || change.added.length === 0) {
      throw new Error("Only additions can be recorded automatically");
    }

    return change;
  });

  writeBaselines(root, changes);
}

/** Lists removed cases and the single acknowledgement command for blocked lanes. */
function explainRemovals(
  root: string,
  checks: readonly ICheckResult[],
  lanes: readonly InventoryLane[]
): ICheckResult[] {
  let review: IInventoryReview;

  try {
    review = reviewInventories(root, lanes);
  } catch {
    return [...checks];
  }

  const removed = review.changes.flatMap((change) =>
    change.removed.map((identity) => `${change.lane} removed: ${identity}`)
  );
  const remediation = [
    ...removed,
    `Acknowledge the reviewed diff with: ${acknowledgeCommand(lanes, review)}`,
    "Then rerun verification.",
  ].join("\n");

  return checks.map((check): ICheckResult =>
    isInventoryLane(check.checkId) &&
    lanes.includes(check.checkId) &&
    check.reason === INVENTORY_REASONS.disagrees
      ? { ...check, remediation }
      : check
  );
}

/**
 * Runs after every lane has finished and the checkout is confirmed unchanged.
 * Any removal blocks recording and prints one acknowledgement command; otherwise
 * additions-only lanes are written to their baselines so the change rides along
 * in the same commit as the tests.
 */
export function settleInventories(
  root: string,
  checks: readonly ICheckResult[],
  fingerprint: string
): ICheckResult[] {
  const laneIds = (reason: string): InventoryLane[] =>
    checks.flatMap((check) =>
      isInventoryLane(check.checkId) && check.reason === reason
        ? [check.checkId]
        : []
    );
  const disagreeing = laneIds(INVENTORY_REASONS.disagrees);

  if (disagreeing.length > 0) {
    return explainRemovals(root, checks, disagreeing);
  }

  const additions = laneIds(INVENTORY_REASONS.additions);

  if (additions.length === 0) {
    return [...checks];
  }

  try {
    recordAdditions(root, additions, fingerprint);

    return [...checks];
  } catch {
    return checks.map((check): ICheckResult =>
      isInventoryLane(check.checkId) && additions.includes(check.checkId)
        ? {
            ...check,
            status: "blocked",
            reason: INVENTORY_REASONS.updateFailed,
          }
        : check
    );
  }
}
