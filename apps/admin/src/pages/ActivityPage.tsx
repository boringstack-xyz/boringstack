import { useEffect, useState } from "react";

import {
  adminGet,
  AuditFeedResponseSchema,
  type IAuditEntry,
} from "../lib/admin-api";

const PAGE_SIZE = "50";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: IAuditEntry[] };

/*
 * Newest-first audit log. Shows user and account ids only: the admin feed
 * carries no emails or metadata.
 */
export const ActivityPage = () => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    adminGet("/audit", AuditFeedResponseSchema, { limit: PAGE_SIZE })
      .then((body) => {
        if (active) {
          setState({ status: "ready", entries: body.entries });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return <p role="status">Loading activity…</p>;
  }

  if (state.status === "error") {
    return <p role="alert">Could not load activity: {state.message}</p>;
  }

  return (
    <section aria-labelledby="activity-heading">
      <h1 id="activity-heading">Activity</h1>
      <table>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Action</th>
            <th scope="col">Resource</th>
            <th scope="col">Actor (user id)</th>
            <th scope="col">Account (id)</th>
          </tr>
        </thead>
        <tbody>
          {state.entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.createdAt}</td>
              <td>{entry.action}</td>
              <td>{entry.resource ?? "-"}</td>
              <td>{entry.actorUserId ?? "system"}</td>
              <td>{entry.targetAccountId ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
