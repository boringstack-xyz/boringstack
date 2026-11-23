/*
 * `factory fleet` (the table or JSON) and `factory fleet serve` (the
 * self-refreshing page on 127.0.0.1). Reads only; nothing runs in the
 * background, so the page costs nothing when nobody has it open.
 */
import type { IFactoryContext } from "../context";
import { nowIso } from "../clock";
import { blocked, ok, type ICommandOutcome, failed } from "../result";
import { renderTable } from "./fleet.format";
import { collectFleet, type IFleetSnapshot } from "./fleet.data";
import { renderFleetPage } from "./fleet.page";
import { type ProcessRunner, runProcess } from "./process";

const DOCKER_DOWN = "Docker cannot be reached, so the fleet is unknown.";

export const fleetStatus = (
  context: IFactoryContext,
  run: ProcessRunner = runProcess
): ICommandOutcome => {
  const snapshot = collectFleet(context, run);

  return snapshot.dockerAvailable
    ? ok(renderTable(snapshot.stacks), { stacks: snapshot.stacks })
    : blocked(DOCKER_DOWN, { reason: "docker_unavailable", stacks: [] });
};

/** The page's HTML and JSON for one moment; `collect` is called per request. */
export const fleetResponse = (
  path: string,
  collect: () => IFleetSnapshot
): Response => {
  if (path === "/") {
    const snapshot = collect();

    return new Response(
      renderFleetPage({
        stacks: snapshot.stacks,
        generatedAt: nowIso(),
        dockerAvailable: snapshot.dockerAvailable,
      }),
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  return path === "/fleet.json"
    ? Response.json(collect())
    : new Response("Not found", { status: 404 });
};

export const fleetServe = (
  context: IFactoryContext,
  run: ProcessRunner = runProcess
): ICommandOutcome => {
  const port = context.config.fleetPort;

  try {
    Bun.serve({
      hostname: "127.0.0.1",
      port,
      fetch: (request) =>
        fleetResponse(new URL(request.url).pathname, () =>
          collectFleet(context, run)
        ),
    });
  } catch (error: unknown) {
    return failed(
      `The fleet page could not start on 127.0.0.1:${String(port)}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return ok(
    `Fleet page: http://127.0.0.1:${String(port)}/ (keeps running until stopped)`
  );
};
