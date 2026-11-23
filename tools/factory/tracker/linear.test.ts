import { describe, expect, test } from "bun:test";

import { createLinearTracker, type IHttp, LINEAR_ENDPOINT } from "./linear";
import { rejectionOf } from "./tracker.fixtures";
import { HANDOVER_MARKER } from "./tracker.utils";

interface ISent {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/* A fake Linear: answers each GraphQL request in order, and records what was sent. */
const fakeHttp = (
  answers: Record<string, unknown>[]
): { http: IHttp; sent: ISent[] } => {
  const sent: ISent[] = [];

  const http: IHttp = (url, init) => {
    sent.push({ url, headers: init.headers, body: init.body });
    const answer = answers.shift() ?? { data: {} };

    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(answer)),
    });
  };

  return { http, sent };
};

/** The variables of the nth request, as sent. */
const variablesOf = (sent: ISent[], index: number): unknown => {
  const parsed: unknown = JSON.parse(sent[index]?.body ?? "{}");

  return typeof parsed === "object" && parsed !== null && "variables" in parsed
    ? parsed.variables
    : undefined;
};

const issueNode = (comments: { id: string; body: string }[]) => ({
  data: {
    issue: {
      id: "uuid-1",
      identifier: "ENG-12",
      title: "Week start setting",
      description: "Admins choose it.",
      url: "https://linear.app/x/issue/ENG-12",
      labels: { nodes: [{ name: "feature" }] },
      comments: { nodes: comments },
      team: {
        states: {
          nodes: [
            { id: "st-done", name: "Done", type: "completed" },
            { id: "st-review", name: "In Review", type: "started" },
          ],
        },
      },
    },
  },
});

describe("Linear tracker", () => {
  test("sends the raw personal key to the GraphQL endpoint and reads the issue", async () => {
    const fake = fakeHttp([issueNode([])]);
    const issue = await createLinearTracker("lin_api_key", fake.http).issue(
      "ENG-12"
    );

    expect(fake.sent[0]?.url).toBe(LINEAR_ENDPOINT);
    expect(fake.sent[0]?.headers.Authorization).toBe("lin_api_key");
    expect(variablesOf(fake.sent, 0)).toEqual({ id: "ENG-12" });
    expect(issue).toMatchObject({
      id: "ENG-12",
      title: "Week start setting",
      body: "Admins choose it.",
      labels: ["feature"],
      comments: [],
    });
  });

  test("adds the card, then moves the issue to its review state", async () => {
    const fake = fakeHttp([
      issueNode([]),
      { data: { commentCreate: { success: true } } },
      issueNode([]),
      { data: { issueUpdate: { success: true } } },
    ]);
    const tracker = createLinearTracker("k", fake.http);

    expect(await tracker.upsertComment("ENG-12", HANDOVER_MARKER, "card")).toBe(
      "created"
    );
    await tracker.setState("ENG-12", "review");

    expect(variablesOf(fake.sent, 1)).toEqual({
      issueId: "uuid-1",
      body: "card",
    });
    expect(variablesOf(fake.sent, 3)).toEqual({
      id: "uuid-1",
      stateId: "st-review",
    });
  });

  test("edits the card that carries the marker", async () => {
    const fake = fakeHttp([
      issueNode([{ id: "cm-9", body: `${HANDOVER_MARKER}\nold` }]),
      { data: { commentUpdate: { success: true } } },
    ]);

    expect(
      await createLinearTracker("k", fake.http).upsertComment(
        "ENG-12",
        HANDOVER_MARKER,
        "new"
      )
    ).toBe("updated");
    expect(variablesOf(fake.sent, 1)).toEqual({ id: "cm-9", body: "new" });
  });

  test("a team without a review state is an error a person can act on", async () => {
    const node = issueNode([]);

    node.data.issue.team.states.nodes = [
      { id: "st-done", name: "Done", type: "completed" },
    ];
    const fake = fakeHttp([node]);
    const message = await rejectionOf(
      createLinearTracker("k", fake.http).setState("ENG-12", "review")
    );

    expect(message).toContain('no "In Review"-type state');
  });

  test("GraphQL errors surface their messages", async () => {
    const fake = fakeHttp([{ errors: [{ message: "Entity not found" }] }]);
    const message = await rejectionOf(
      createLinearTracker("k", fake.http).issue("ENG-999")
    );

    expect(message).toContain("Entity not found");
  });
});
