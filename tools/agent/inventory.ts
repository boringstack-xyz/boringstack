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
  type IInventoryReview,
} from "./inventory-review";
import type { IInventory, InventoryLane } from "./inventory.types";
import type { ICheckResult } from "./result";
import { isRecord, isStringArray, parseRecord } from "./validation";

export const LANES = ["api.tests", "ui.tests", "ui.e2e"] as const;
export type Lane = InventoryLane;

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

function readInventory(path: string): IInventory {
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

function recordObservation(
  root: string,
  lane: InventoryLane,
  cases: string[],
  expectedFingerprint?: string
): void {
  const checkout = identifyCheckout(root);

  if (expectedFingerprint !== checkout.fingerprint) {
    return;
  }

  const directory = join(root, ".agent-state/observed-tests");
  const path = join(directory, `${lane}.json`);

  assertSafePath(directory);
  assertSafePath(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, checkout, cases }), {
    mode: 0o600,
  });
}

export function inventoryEvidence(
  root: string,
  lane: InventoryLane,
  xml: string,
  evidence: ICheckResult,
  expectedFingerprint?: string
): ICheckResult {
  const actual = identities(xml, root);

  if (evidence.status === "passed") {
    recordObservation(root, lane, actual, expectedFingerprint);
  }

  if (evidence.status === "blocked") {
    return evidence;
  }

  try {
    const path = join(root, "tools/agent/inventories", `${lane}.json`);
    const expected = readInventory(path);

    if (compareInventory(expected.cases, actual)) {
      return evidence;
    }
  } catch {
    // Missing or malformed expectations cannot establish complete execution.
  }

  return { ...evidence, status: "blocked", reason: "test_inventory_disagrees" };
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

  const directory = join(root, "tools/agent/inventories");

  assertSafePath(directory);

  for (const lane of lanes) {
    assertSafePath(join(directory, `${lane}.json`));
  }

  mkdirSync(directory, { recursive: true });

  for (const change of review.changes) {
    writeFileSync(
      join(directory, `${change.lane}.json`),
      `${JSON.stringify({ schemaVersion: 1, cases: change.after }, null, 2)}\n`
    );
  }
}
