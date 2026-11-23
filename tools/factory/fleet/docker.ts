import { FACTORY_CONFIG } from "../factory.config";
import {
  COMPOSE_PROJECT_LABEL,
  type IContainer,
  type IStat,
  parseContainers,
  parseStats,
} from "./fleet.utils";
import type { ProcessRunner } from "./process";
import { slotOfProject } from "./slots.utils";

export interface IStackContainer extends IContainer {
  readonly slot: number;
}

/**
 * Every container of every factory stack (compose project `<project>-s<N>`),
 * running or not. Null when Docker cannot be asked, so callers can say
 * "blocked" instead of "no stacks".
 */
export const listStackContainers = (
  run: ProcessRunner,
  prefix: string = FACTORY_CONFIG.project
): IStackContainer[] | null => {
  const result = run("docker", [
    "ps",
    "-a",
    "--filter",
    `label=${COMPOSE_PROJECT_LABEL}`,
    "--format",
    "json",
  ]);

  if (result.status !== 0) {
    return null;
  }

  return parseContainers(result.stdout).flatMap((container) => {
    const slot = slotOfProject(container.project, prefix);

    return slot === null ? [] : [{ ...container, slot }];
  });
};

/** Memory and CPU of the named containers, read once (no streaming). */
export const readStats = (
  run: ProcessRunner,
  names: readonly string[]
): IStat[] => {
  if (names.length === 0) {
    return [];
  }

  const result = run("docker", [
    "stats",
    "--no-stream",
    "--format",
    "json",
    ...names,
  ]);

  return result.status === 0 ? parseStats(result.stdout) : [];
};

/**
 * One container's log text since a time, both output streams. Docker writes
 * the service's stdout and stderr separately, so the lines are merged here
 * and sorted by their timestamps by the caller.
 */
export const readContainerLog = (
  run: ProcessRunner,
  name: string,
  sinceIso: string
): string[] => {
  const result = run(
    "docker",
    ["logs", "--timestamps", "--since", sinceIso, name],
    { timeoutMs: 30_000 }
  );

  return [...result.stdout.split("\n"), ...result.stderr.split("\n")].filter(
    (line) => line.trim() !== ""
  );
};
