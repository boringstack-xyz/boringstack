import { describe, expect, test } from "bun:test";

import { acceptanceCriteria, issueText } from "./issue.utils";

describe("acceptanceCriteria", () => {
  test("reads the items under an Acceptance criteria heading, stopping at the next heading", () => {
    const body = [
      "Context first.",
      "",
      "## Acceptance criteria",
      "- Admins can set the week start",
      "- [ ] The date picker follows it",
      "1. Existing ranges keep their meaning",
      "",
      "## Notes",
      "- not a criterion",
    ].join("\n");

    expect(acceptanceCriteria(body)).toEqual([
      "Admins can set the week start",
      "The date picker follows it",
      "Existing ranges keep their meaning",
    ]);
  });

  test("falls back to checklist items anywhere when there is no heading", () => {
    const body = "Do it.\n- [ ] first\n- [x] second\n- plain bullet";

    expect(acceptanceCriteria(body)).toEqual(["first", "second"]);
  });

  test("empty when the issue states none", () => {
    expect(acceptanceCriteria("Just a screenshot and a title.")).toEqual([]);
  });
});

describe("issueText", () => {
  const issue = {
    id: "12",
    title: "Week start setting",
    body: "Admins choose it.",
    labels: ["feature"],
    url: "https://github.com/boringstack-xyz/boringstack/issues/12",
    comments: [],
  };

  test("prints the title, labels, criteria and body", () => {
    const text = issueText(issue, ["Admins can set it"]);

    expect(text).toContain("12: Week start setting");
    expect(text).toContain("Labels: feature");
    expect(text).toContain("- Admins can set it");
    expect(text.endsWith("Admins choose it.")).toBe(true);
  });

  test("says plainly when no criteria are written", () => {
    expect(issueText({ ...issue, labels: [] }, [])).toContain("none written");
    expect(issueText({ ...issue, labels: [] }, [])).toContain("Labels: none");
  });
});
