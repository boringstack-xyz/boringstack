import { isAborted } from "./validation";

export interface ITask {
  id: string;
  after?: readonly string[];
  slots?: number;
  priority?: number;
  run: () => Promise<boolean>;
  blocked: (reason: string) => void;
}

export interface ITaskTiming {
  id: string;
  startedAfterMs: number;
  durationMs: number;
  status: "passed" | "failed" | "blocked";
}

function validateTasks(tasks: readonly ITask[]): void {
  const byId = new Map(tasks.map((task) => [task.id, task]));

  if (byId.size !== tasks.length) {
    throw new Error("Duplicate verification task");
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string): void => {
    if (visited.has(id)) {
      return;
    }

    const task = byId.get(id);

    if (task === undefined || visiting.has(id)) {
      throw new Error(`Invalid verification dependency: ${id}`);
    }

    visiting.add(id);

    for (const dependency of task.after ?? []) {
      visit(dependency);
    }

    visiting.delete(id);
    visited.add(id);
  };

  for (const task of tasks) {
    if (!Number.isSafeInteger(task.slots ?? 1) || (task.slots ?? 1) < 1) {
      throw new Error(`Invalid verification slots: ${task.id}`);
    }

    visit(task.id);
  }
}

/** Only ready work occupies capacity; failed dependencies block their descendants. */
export async function runTasks(
  tasks: readonly ITask[],
  capacity: number,
  signal?: AbortSignal,
  progress: (id: string, state: "started" | "finished") => void = () =>
    undefined
): Promise<ITaskTiming[]> {
  validateTasks(tasks);

  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error("Invalid verification capacity");
  }

  if (tasks.some((task) => (task.slots ?? 1) > capacity)) {
    throw new Error("Verification task exceeds capacity");
  }

  const pending = [...tasks].sort(
    (left, right) => (right.priority ?? 0) - (left.priority ?? 0)
  );
  const running = new Map<string, Promise<void>>();
  const completed = new Map<string, boolean>();
  const timings: ITaskTiming[] = [];
  const start = performance.now();
  let used = 0;

  while (pending.length > 0 || running.size > 0) {
    // Starting tasks removes them from pending; iterate a stable snapshot.
    const batch = pending.slice();

    for (const task of batch) {
      const dependencies = task.after ?? [];
      const interrupted = isAborted(signal);
      const failed = dependencies.some((id) => completed.get(id) === false);

      if (interrupted || failed) {
        pending.splice(pending.indexOf(task), 1);
        completed.set(task.id, false);
        task.blocked(interrupted ? "interrupted" : "prerequisite_failed");
        timings.push({
          id: task.id,
          startedAfterMs: Math.round(performance.now() - start),
          durationMs: 0,
          status: "blocked",
        });
        continue;
      }

      const slots = task.slots ?? 1;

      if (dependencies.some((id) => !completed.has(id))) {
        continue;
      }

      // Reserve capacity for ready, higher-priority work rather than starving its worker pool.
      if (used + slots > capacity) {
        break;
      }

      pending.splice(pending.indexOf(task), 1);
      used += slots;
      const started = performance.now();

      progress(task.id, "started");
      const execution = Promise.resolve()
        .then(() => task.run())
        .then(
          (passed) => {
            completed.set(task.id, passed);

            return passed ? ("passed" as const) : ("failed" as const);
          },
          () => {
            completed.set(task.id, false);
            task.blocked(isAborted(signal) ? "interrupted" : "task_exception");

            return "blocked" as const;
          }
        )
        .then((status) => {
          timings.push({
            id: task.id,
            startedAfterMs: Math.round(started - start),
            durationMs: Math.round(performance.now() - started),
            status,
          });
          used -= slots;
          running.delete(task.id);
          progress(task.id, "finished");
        });

      running.set(task.id, execution);
    }

    if (running.size > 0) {
      await Promise.race(running.values());
    }
  }

  const order = new Map(tasks.map((task, index) => [task.id, index]));

  return timings.sort(
    (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)
  );
}
