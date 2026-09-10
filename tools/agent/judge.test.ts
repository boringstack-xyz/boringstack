import { expect, test } from "bun:test";
import { judge } from "../agent-evals/judge";

const xml = (first: string, second: string) =>
  `<testsuites><testcase name="isolation">${first}</testcase><testcase name="control">${second}</testcase></testsuites>`;
const fail = '<failure type="AssertionError">expected</failure>';

test("mutant evidence requires the named defect and its passing control", () => {
  expect(
    judge("m", xml(fail, ""), 1, ["isolation", "control"], ["isolation"]).status
  ).toBe("passed");
  expect(
    judge("m", xml("", fail), 1, ["isolation", "control"], ["isolation"]).status
  ).toBe("failed");
  expect(
    judge("m", xml(fail, fail), 1, ["isolation", "control"], ["isolation"])
      .status
  ).toBe("failed");
  expect(
    judge(
      "m",
      xml(fail, ""),
      1,
      ["isolation", "control", "missing"],
      ["isolation"]
    ).status
  ).toBe("failed");
  expect(
    judge(
      "m",
      xml(fail, "").replace('name="control"', 'name="isolation"'),
      1,
      ["isolation", "control"],
      ["isolation"]
    ).status
  ).toBe("failed");
});
