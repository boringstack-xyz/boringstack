import { MemoryRouter } from "react-router-dom";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { NotificationListItem } from "./NotificationListItem";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en" }
    })
  };
});

function renderItem(props: Parameters<typeof NotificationListItem>[0]) {
  return render(
    <MemoryRouter>
      <NotificationListItem {...props} />
    </MemoryRouter>
  );
}

const baseNotification = {
  id: "n1",
  eventType: "test.event",
  title: "Hello",
  body: "Body text",
  ctaUrl: null,
  ctaLabel: null,
  status: "unread" as const,
  readAt: null,
  createdAt: "2026-05-15T00:00:00.000Z"
};

describe("NotificationListItem", () => {
  it("shows the title and body", () => {
    renderItem({ notification: baseNotification });
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("fires onMarkRead when the mark-read button is clicked", async () => {
    const onMarkRead = vi.fn();

    renderItem({ notification: baseNotification, onMarkRead });
    await userEvent.click(
      screen.getByRole("button", { name: "notifications.markAsRead" })
    );
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("does not render the mark-read button on read items", () => {
    renderItem({
      notification: { ...baseNotification, status: "read" },
      onMarkRead: vi.fn()
    });
    expect(
      screen.queryByRole("button", { name: "notifications.markAsRead" })
    ).not.toBeInTheDocument();
  });

  it("renders the CTA link when ctaUrl is set", () => {
    renderItem({
      notification: {
        ...baseNotification,
        ctaUrl: "/somewhere",
        ctaLabel: "Open it"
      }
    });
    expect(screen.getByRole("link", { name: "Open it" })).toHaveAttribute(
      "href",
      "/somewhere"
    );
  });
});
