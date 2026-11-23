import { readContainerLog, type IStackContainer } from "./docker";
import type { ProcessRunner } from "./process";
import { byTime, type ILogRecord, parseLogLine } from "./logs.utils";

/** Every container's records since a time, merged in time order. */
export const readRecords = (
  run: ProcessRunner,
  containers: readonly IStackContainer[],
  since: Date
): ILogRecord[] =>
  byTime(
    containers.flatMap((container) =>
      readContainerLog(run, container.name, since.toISOString()).flatMap(
        (line) => {
          const record = parseLogLine(line, container.service);

          return record === null ? [] : [record];
        }
      )
    )
  );
