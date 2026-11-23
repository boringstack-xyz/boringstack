import { useEffect, useState } from "react";

import {
  adminGet,
  QueueStatsResponseSchema,
  type IQueueStats,
} from "../lib/admin-api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; queues: IQueueStats[] };

export const OverviewPage = () => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    adminGet("/queues", QueueStatsResponseSchema)
      .then((body) => {
        if (active) {
          setState({ status: "ready", queues: body.queues });
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
    return <p role="status">Loading queues…</p>;
  }

  if (state.status === "error") {
    return <p role="alert">Could not load queues: {state.message}</p>;
  }

  return (
    <section aria-labelledby="queues-heading">
      <h1 id="queues-heading">Queues</h1>
      <table>
        <thead>
          <tr>
            <th scope="col">Queue</th>
            <th scope="col">Waiting</th>
            <th scope="col">Active</th>
            <th scope="col">Completed</th>
            <th scope="col">Failed</th>
            <th scope="col">Delayed</th>
            <th scope="col">Paused</th>
          </tr>
        </thead>
        <tbody>
          {state.queues.map((queue) => (
            <tr key={queue.name}>
              <th scope="row">{queue.name}</th>
              <td>{queue.counts.waiting}</td>
              <td>{queue.counts.active}</td>
              <td>{queue.counts.completed}</td>
              <td>{queue.counts.failed}</td>
              <td>{queue.counts.delayed}</td>
              <td>{queue.counts.paused}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
