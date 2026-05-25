import { afterEach, describe, expect, test } from "bun:test";
import { t } from "elysia";
import {
  defineNotificationEvent,
  eventRegistry,
} from "../../../../src/lib/notifications";

const exampleSchema = t.Object({ value: t.String() });

const buildEvent = (type: string) =>
  defineNotificationEvent({
    type,
    schema: exampleSchema,
    defaultChannels: ["in-app"],
    render: {
      inApp: ({ payload }) => ({
        title: type,
        body: payload.value,
      }),
    },
  });

describe("EventRegistry", () => {
  afterEach(() => {
    eventRegistry.clear();
  });

  test("register + get round-trips an event by its type id", () => {
    const event = buildEvent("registry.test.alpha");

    eventRegistry.register(event);

    const found = eventRegistry.get("registry.test.alpha");

    expect(found?.type).toBe("registry.test.alpha");
  });

  test("has() reports presence without retrieving", () => {
    eventRegistry.register(buildEvent("registry.test.beta"));

    expect(eventRegistry.has("registry.test.beta")).toBe(true);
    expect(eventRegistry.has("registry.test.missing")).toBe(false);
  });

  test("registerAll inserts every event passed to it", () => {
    eventRegistry.registerAll([
      buildEvent("registry.test.gamma"),
      buildEvent("registry.test.delta"),
    ]);

    expect(eventRegistry.size()).toBe(2);
    expect(eventRegistry.has("registry.test.gamma")).toBe(true);
    expect(eventRegistry.has("registry.test.delta")).toBe(true);
  });

  test("re-registering an event id overwrites the prior entry", () => {
    const first = defineNotificationEvent({
      type: "registry.test.collision",
      schema: exampleSchema,
      defaultChannels: ["in-app"],
      render: {
        inApp: () => ({ title: "first", body: "" }),
      },
    });
    const second = defineNotificationEvent({
      type: "registry.test.collision",
      schema: exampleSchema,
      defaultChannels: ["email"],
      render: {
        inApp: () => ({ title: "second", body: "" }),
      },
    });

    eventRegistry.register(first);
    eventRegistry.register(second);

    const found = eventRegistry.get("registry.test.collision");

    expect(found?.defaultChannels).toEqual(["email"]);
  });

  test("clear() empties the registry", () => {
    eventRegistry.register(buildEvent("registry.test.epsilon"));
    expect(eventRegistry.size()).toBe(1);

    eventRegistry.clear();
    expect(eventRegistry.size()).toBe(0);
  });
});
