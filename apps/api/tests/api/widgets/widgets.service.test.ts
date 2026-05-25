import { beforeEach, describe, expect, test } from "bun:test";

import { widgetsService } from "../../../src/api/widgets/widgets.service";
import { seedVerifiedUser } from "../../helpers/auth";
import { cleanDatabase, requireDb } from "../../helpers/db";

const seedAccount = async (
  email: string
): Promise<{ accountId: string; userId: string }> => {
  const { account, user } = await seedVerifiedUser({ email });

  return { accountId: account.id, userId: user.id };
};

describe("widgetsService.list", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns an empty array for a fresh account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId } = await seedAccount("widgets-list@example.com");

    expect(await widgetsService.list(accountId)).toEqual([]);
  });

  test("returns widgets in createdAt-ascending order", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedAccount(
      "widgets-order@example.com"
    );

    await widgetsService.create(accountId, userId, { name: "Alpha" });
    await widgetsService.create(accountId, userId, { name: "Beta" });
    await widgetsService.create(accountId, userId, { name: "Gamma" });

    const rows = await widgetsService.list(accountId);

    expect(rows.map((row) => row.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});

describe("widgetsService.getById", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("returns the widget when it belongs to the caller's account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedAccount("widgets-get@example.com");
    const created = await widgetsService.create(accountId, userId, {
      name: "Solo",
    });

    const fetched = await widgetsService.getById(accountId, created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Solo");
  });

  test("throws notFound when the widget belongs to a different account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId: aliceAccount, userId: ua } = await seedAccount(
      "widgets-iso-aliceAccount@example.com"
    );
    const { accountId: bobAccount } = await seedAccount(
      "widgets-iso-bobAccount@example.com"
    );

    const widget = await widgetsService.create(aliceAccount, ua, {
      name: "Private",
    });

    expect(widgetsService.getById(bobAccount, widget.id)).rejects.toThrow(
      /not found/i
    );
  });
});

describe("widgetsService.update", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("updates the name within the same account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedAccount(
      "widgets-update@example.com"
    );
    const widget = await widgetsService.create(accountId, userId, {
      name: "Old",
    });

    const updated = await widgetsService.update(accountId, userId, widget.id, {
      name: "New",
    });

    expect(updated.name).toBe("New");
  });

  test("refuses cross-account updates (404)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId: aliceAccount, userId: ua } = await seedAccount(
      "widgets-update-iso-aliceAccount@example.com"
    );
    const { accountId: bobAccount, userId: ub } = await seedAccount(
      "widgets-update-iso-bobAccount@example.com"
    );
    const widget = await widgetsService.create(aliceAccount, ua, {
      name: "Untouchable",
    });

    expect(
      widgetsService.update(bobAccount, ub, widget.id, { name: "Hacked" })
    ).rejects.toThrow(/not found/i);
  });
});

describe("widgetsService.delete", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("removes the widget and a subsequent list omits it", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedAccount(
      "widgets-delete@example.com"
    );
    const widget = await widgetsService.create(accountId, userId, {
      name: "Bye",
    });

    await widgetsService.delete(accountId, userId, widget.id);

    expect(await widgetsService.list(accountId)).toEqual([]);
  });

  test("refuses cross-account deletes (404)", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId: aliceAccount, userId: ua } = await seedAccount(
      "widgets-delete-iso-aliceAccount@example.com"
    );
    const { accountId: bobAccount, userId: ub } = await seedAccount(
      "widgets-delete-iso-bobAccount@example.com"
    );
    const widget = await widgetsService.create(aliceAccount, ua, {
      name: "Mine",
    });

    expect(widgetsService.delete(bobAccount, ub, widget.id)).rejects.toThrow(
      /not found/i
    );
  });
});

describe("widgetsService.create", () => {
  beforeEach(async () => {
    if (!(await requireDb())) {
      return;
    }

    await cleanDatabase();
  });

  test("creates a widget scoped to the account", async () => {
    if (!(await requireDb())) {
      return;
    }

    const { accountId, userId } = await seedAccount(
      "widgets-create@example.com"
    );
    const widget = await widgetsService.create(accountId, userId, {
      name: "Created",
    });

    expect(widget.name).toBe("Created");
    expect(widget.accountId).toBe(accountId);
  });
});
