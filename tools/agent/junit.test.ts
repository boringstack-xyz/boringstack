import { expect, test } from "bun:test";
import { mergeJunitReports, shardFiles, suiteDurations } from "./junit";
import { testEvidence } from "./reports";
import { shardLane, SANDBOX_LANES } from "./sandbox/lifecycle";

const report = (name: string, failures: number): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="2" failures="${String(failures)}">
  <testsuite name="${name}" tests="2" failures="${String(failures)}">
    <testcase name="${name} one" classname="${name}" file="${name}.test.ts" time="0.01"></testcase>
    <testcase name="${name} two" classname="${name}" file="${name}.test.ts" time="0.01">${
      failures > 0
        ? '<failure type="AssertionError" message="expected"><![CDATA[boom]]></failure>'
        : ""
    }</testcase>
  </testsuite>
</testsuites>
`;

test("merged shard reports read as one passing run", () => {
  const merged = mergeJunitReports([report("f01", 0), report("f02", 0)]);
  const evidence = testEvidence("security.tests", merged, 0);

  expect((merged.match(/<testcase\b/g) ?? []).length).toBe(4);
  expect(merged.match(/<testsuites/g)).toHaveLength(1);
  expect(evidence.status).toBe("passed");
});

test("a failing shard fails the merged run and a malformed shard invalidates it", () => {
  const merged = mergeJunitReports([report("f01", 0), report("f02", 1)]);

  expect(testEvidence("security.tests", merged, 1).status).toBe("failed");
  expect(mergeJunitReports([report("f01", 0), "not xml"])).toBe("");
  expect(testEvidence("security.tests", "", 0).status).toBe("blocked");
});

test("files pack largest-first into balanced, deterministic shards", () => {
  const files = [
    { path: "a", size: 10 },
    { path: "b", size: 9 },
    { path: "c", size: 8 },
    { path: "d", size: 1 },
    { path: "e", size: 1 },
  ];
  const shards = shardFiles(files, 3);

  expect(shards).toEqual([["a"], ["b", "e"], ["c", "d"]]);
  expect(shardFiles(files, 1)).toEqual([["a", "b", "c", "d", "e"]]);
  expect(shardFiles([], 3)).toEqual([]);
  expect(shardFiles(files, 3)).toEqual(shards);
});

test("shard lanes are distinct from each other and from the fixed lanes", () => {
  const lanes = [
    ...[1, 2, 3, 4].map((index) => shardLane("security", index, 4)),
    ...[1, 2, 3, 4].map((index) => shardLane("tests", index, 4)),
  ];
  const fixed = Object.values(SANDBOX_LANES);
  const keys = [...lanes, ...fixed].map(
    (lane) => `${lane.database}/${String(lane.valkeyDb)}`
  );

  expect(new Set(keys).size).toBe(keys.length);
  expect(lanes[0]).toEqual({
    name: "security-1",
    database: "app_security_1",
    valkeyDb: 5,
  });
  expect(lanes[4]).toEqual({
    name: "tests-1",
    database: "app_tests_1",
    valkeyDb: 9,
  });
  expect(shardLane("security", 1, 1)).toBe(SANDBOX_LANES.security);
  expect(shardLane("tests", 1, 1)).toBe(SANDBOX_LANES.tests);
  expect(() => shardLane("security", 5, 4)).toThrow("Invalid shard");
  expect(() => shardLane("tests", 1, 5)).toThrow("Invalid shard");
});

test("suite durations come from the per-file testsuite time attributes", () => {
  const merged = mergeJunitReports([
    report("f01", 0),
    report("f02", 0),
  ]).replace(
    '<testsuite name="f01" tests="2" failures="0">',
    '<testsuite name="f01" file="security-spec/f01.test.ts" tests="2" failures="0" time="41.5">'
  );

  expect(suiteDurations(merged)).toEqual({ "security-spec/f01.test.ts": 41.5 });
  expect(suiteDurations("")).toEqual({});
});
