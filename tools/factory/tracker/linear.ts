import type {
  IComment,
  IIssue,
  IssueState,
  ITracker,
  UpsertResult,
} from "./tracker.types";
import { linearStateId, planUpsert } from "./tracker.utils";

/* Linear through its GraphQL API. The key is a personal API key (no "Bearer"). */
export const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

export interface IHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text: () => Promise<string>;
}

export type IHttp = (
  url: string,
  init: {
    readonly method: "POST";
    readonly headers: Record<string, string>;
    readonly body: string;
  }
) => Promise<IHttpResponse>;

type Json = Record<string, unknown>;

const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nodesOf = (value: unknown): Json[] =>
  isJson(value) && Array.isArray(value.nodes) ? value.nodes.filter(isJson) : [];

const stringOf = (value: unknown, key: string): string => {
  const found = isJson(value) ? value[key] : undefined;

  return typeof found === "string" ? found : "";
};

interface ILinearIssue {
  readonly uuid: string;
  readonly issue: IIssue;
  readonly teamStates: { id: string; name: string; type: string }[];
}

export const createLinearTracker = (apiKey: string, http: IHttp): ITracker => {
  const query = async (text: string, variables: Json): Promise<Json> => {
    const response = await http(LINEAR_ENDPOINT, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query: text, variables }),
    });
    const parsed: unknown = JSON.parse(await response.text());

    if (!response.ok || !isJson(parsed) || parsed.errors !== undefined) {
      const reason =
        isJson(parsed) && Array.isArray(parsed.errors)
          ? parsed.errors.map((error) => stringOf(error, "message")).join("; ")
          : `HTTP ${String(response.status)}`;

      throw new Error(`Linear refused the request: ${reason}`);
    }

    return isJson(parsed.data) ? parsed.data : {};
  };

  const readIssue = async (id: string): Promise<ILinearIssue> => {
    const data = await query(
      `query($id: String!) { issue(id: $id) { id identifier title description url
        labels { nodes { name } }
        comments { nodes { id body } }
        team { states { nodes { id name type } } } } }`,
      { id }
    );
    const node = isJson(data.issue) ? data.issue : undefined;

    if (node === undefined) {
      throw new Error(`Linear has no issue ${id}`);
    }

    const comments: IComment[] = nodesOf(node.comments).map((comment) => ({
      id: stringOf(comment, "id"),
      body: stringOf(comment, "body"),
    }));
    const teamStates = isJson(node.team)
      ? nodesOf(node.team.states).map((state) => ({
          id: stringOf(state, "id"),
          name: stringOf(state, "name"),
          type: stringOf(state, "type"),
        }))
      : [];

    return {
      uuid: stringOf(node, "id"),
      teamStates,
      issue: {
        id,
        title: stringOf(node, "title"),
        body: stringOf(node, "description"),
        labels: nodesOf(node.labels).map((label) => stringOf(label, "name")),
        url: stringOf(node, "url"),
        comments,
      },
    };
  };

  return {
    name: "linear",
    issue: async (id) => {
      const current = await readIssue(id);

      return current.issue;
    },
    upsertComment: async (issueId, marker, body): Promise<UpsertResult> => {
      const current = await readIssue(issueId);
      const plan = planUpsert(current.issue.comments, marker);

      if (plan.action === "create") {
        await query(
          "mutation($issueId: String!, $body: String!) { commentCreate(input: {issueId: $issueId, body: $body}) { success } }",
          { issueId: current.uuid, body }
        );

        return "created";
      }

      await query(
        "mutation($id: String!, $body: String!) { commentUpdate(id: $id, input: {body: $body}) { success } }",
        { id: plan.id, body }
      );

      return "updated";
    },
    setState: async (issueId: string, state: IssueState): Promise<void> => {
      const current = await readIssue(issueId);
      const stateId = linearStateId(current.teamStates, state);

      if (stateId === undefined) {
        throw new Error(
          `the team of ${issueId} has no "In Review"-type state; ask a person to add one`
        );
      }

      await query(
        "mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: {stateId: $stateId}) { success } }",
        { id: current.uuid, stateId }
      );
    },
  };
};
