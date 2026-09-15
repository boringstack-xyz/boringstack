import { expect, test } from "bun:test";
import { runTasks, type ITask } from "./scheduler";
import { executionBudget } from "./scheduling";

test("local budget uses a 16-core host with headroom and conservative CI defaults", () => {
  const memory = 64 * 1024 ** 3;

  expect(executionBudget({}, 16, memory)).toMatchObject({
    slots: 14,
    testWorkers: 4,
  });
  expect(executionBudget({ CI: "true" }, 16, memory)).toMatchObject({
    slots: 4,
    testWorkers: 1,
  });
  expect(executionBudget({ CI: "true" }, 2, memory)).toMatchObject({
    slots: 2,
    testWorkers: 1,
  });
  expect(executionBudget({}, 16, 4 * 1024 ** 3).slots).toBe(2);
  expect(
    executionBudget(
      { AGENT_VERIFY_PARALLEL: "1", AGENT_VERIFY_TEST_WORKERS: "8" },
      16,
      memory
    )
  ).toMatchObject({ slots: 1, testWorkers: 1 });
  expect(
    executionBudget(
      { AGENT_VERIFY_PARALLEL: "8", AGENT_VERIFY_TEST_WORKERS: "2" },
      16,
      memory
    )
  ).toMatchObject({ slots: 8, testWorkers: 2 });
});

test("waiting size gates do not occupy a slot needed by independent builds", async () => {
  const seen: string[] = [];
  let finishBuild = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    finishBuild = resolve;
  });

  const blocked = (): void => {
    throw new Error("Unexpected blocked task");
  };

  const tasks: ITask[] = [
    {
      id: "ui.build",
      run: async () => {
        await gate;
        seen.push("ui.build");

        return true;
      },
      blocked,
    },
    {
      id: "ui.size",
      after: ["ui.build"],
      run: () => {
        seen.push("ui.size");

        return Promise.resolve(true);
      },
      blocked,
    },
    {
      id: "docs.build",
      run: () => {
        seen.push("docs.build");

        return Promise.resolve(true);
      },
      blocked,
    },
  ];
  const running = runTasks(tasks, 2);

  try {
    await Bun.sleep(5);
    expect(seen).toEqual(["docs.build"]);
  } finally {
    finishBuild();
    await running;
  }

  expect(seen).toEqual(["docs.build", "ui.build", "ui.size"]);
});

test("worker pools share the slot budget and all independent tasks finish", async () => {
  let used = 0;
  let peak = 0;
  const tasks: ITask[] = [3, 2, 1, 1].map((slots, index) => ({
    id: String(index),
    slots,
    blocked: () => undefined,
    run: async () => {
      used += slots;
      peak = Math.max(peak, used);
      await Bun.sleep(5);
      used -= slots;

      return true;
    },
  }));
  const timings = await runTasks(tasks, 4);

  expect(peak).toBe(4);
  expect(timings).toHaveLength(4);
  expect(timings.every((timing) => timing.status === "passed")).toBe(true);
});

test("small checks cannot starve a ready higher-priority worker pool", async () => {
  const seen: string[] = [];
  let finish = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const blocked = (): void => undefined;
  const tasks: ITask[] = [
    {
      id: "active",
      slots: 2,
      priority: 100,
      blocked,
      run: async () => {
        await gate;

        return true;
      },
    },
    { id: "prepare", priority: 100, blocked, run: () => Promise.resolve(true) },
    {
      id: "browser",
      slots: 3,
      priority: 80,
      after: ["prepare"],
      blocked,
      run: () => {
        seen.push("browser");

        return Promise.resolve(true);
      },
    },
    {
      id: "small",
      after: ["prepare"],
      blocked,
      run: () => {
        seen.push("small");

        return Promise.resolve(true);
      },
    },
  ];
  const running = runTasks(tasks, 4);

  try {
    await Bun.sleep(5);
    expect(seen).toEqual([]);
  } finally {
    finish();
    await running;
  }

  expect(seen).toEqual(["browser", "small"]);
});

test("failed and crashed prerequisites block descendants but not independent work", async () => {
  const blockedIds: string[] = [];
  const seen: string[] = [];
  const task = (id: string, after: string[] = []): ITask => ({
    id,
    after,
    blocked: () => {
      blockedIds.push(id);
    },
    run: () => {
      seen.push(id);

      return Promise.resolve(id !== "failed");
    },
  });
  const tasks = [
    task("failed"),
    task("dependent", ["failed"]),
    task("descendant", ["dependent"]),
    task("independent"),
    { ...task("crashed"), run: () => Promise.reject(new Error("crash")) },
    task("crash-dependent", ["crashed"]),
  ];

  await runTasks(tasks, 2);
  expect(seen).toEqual(["failed", "independent"]);
  expect(blockedIds.sort()).toEqual([
    "crash-dependent",
    "crashed",
    "dependent",
    "descendant",
  ]);
});

test("abort records unstarted tasks as blocked and waits for active work", async () => {
  const controller = new AbortController();
  const seen: string[] = [];
  const tasks: ITask[] = ["first", "second"].map((id) => ({
    id,
    blocked: () => {
      seen.push(`${id}.blocked`);
    },
    run: async () => {
      controller.abort();
      await Bun.sleep(5);
      seen.push(id);

      return true;
    },
  }));

  await runTasks(tasks, 1, controller.signal);
  expect(seen).toEqual(["first", "second.blocked"]);
});

test("invalid graphs fail before executing any task", async () => {
  const task = (id: string, after: string[] = []): ITask => ({
    id,
    after,
    run: () => Promise.reject(new Error("Should not execute")),
    blocked: () => undefined,
  });

  const invalid = [
    {
      tasks: [task("first", ["missing"])],
      capacity: 1,
      message: "Invalid verification dependency",
    },
    {
      tasks: [task("first", ["second"]), task("second", ["first"])],
      capacity: 1,
      message: "Invalid verification dependency",
    },
    {
      tasks: [task("first"), task("first")],
      capacity: 1,
      message: "Duplicate verification task",
    },
    {
      tasks: [task("first")],
      capacity: 0,
      message: "Invalid verification capacity",
    },
  ];

  for (const fixture of invalid) {
    let failure: unknown;

    try {
      await runTasks(fixture.tasks, fixture.capacity);
    } catch (error) {
      failure = error;
    }

    expect(failure instanceof Error ? failure.message : "").toContain(
      fixture.message
    );
  }
});

test("the UI pool grows to half the budget locally and stays with the browser pool in CI", () => {
  const local = executionBudget({}, 20, 64 * 1024 ** 3);
  const ci = executionBudget({ CI: "true" }, 20, 64 * 1024 ** 3);
  const pinned = executionBudget(
    { AGENT_VERIFY_TEST_WORKERS: "2" },
    20,
    64 * 1024 ** 3
  );

  expect(local).toMatchObject({
    slots: 18,
    testWorkers: 4,
    uiTestWorkers: 8,
    securityShards: 4,
  });
  expect(ci).toMatchObject({
    slots: 4,
    testWorkers: 1,
    uiTestWorkers: 1,
    securityShards: 1,
  });
  expect(pinned).toMatchObject({
    testWorkers: 2,
    uiTestWorkers: 2,
    securityShards: 2,
  });
});
