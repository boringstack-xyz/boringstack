import { afterEach, describe, expect, test } from "bun:test";
import {
  channelRegistry,
  type INotificationChannel,
} from "../../../../src/lib/notifications";

const makeChannel = (
  name: "in-app" | "email" | "sse"
): INotificationChannel => ({
  name,
  dispatch: async () => {
    /* no-op for registry tests */
  },
});

describe("ChannelRegistry", () => {
  afterEach(() => {
    channelRegistry.clear();
  });

  test("register + get returns the channel by name", () => {
    const ch = makeChannel("in-app");

    channelRegistry.register(ch);

    const found = channelRegistry.get("in-app");

    expect(found?.name).toBe("in-app");
  });

  test("has() reports presence without retrieving", () => {
    channelRegistry.register(makeChannel("email"));

    expect(channelRegistry.has("email")).toBe(true);
    expect(channelRegistry.has("sse")).toBe(false);
  });

  test("re-registering the same name overwrites — useful for test mocks", () => {
    const original = makeChannel("in-app");
    const replacement: INotificationChannel = {
      name: "in-app",
      dispatch: async () => {
        /* mock */
      },
    };

    channelRegistry.register(original);
    channelRegistry.register(replacement);

    expect(channelRegistry.get("in-app")).toBe(replacement);
  });

  test("clear() empties the registry", () => {
    channelRegistry.register(makeChannel("in-app"));
    channelRegistry.register(makeChannel("email"));
    expect(channelRegistry.size()).toBe(2);

    channelRegistry.clear();
    expect(channelRegistry.size()).toBe(0);
  });
});
