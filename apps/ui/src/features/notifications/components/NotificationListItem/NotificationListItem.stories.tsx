import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { now } from "@/lib/time/now";

import NotificationListItem from "./NotificationListItem";

const meta: Meta<typeof NotificationListItem> = {
  title: "Features/Notifications/NotificationListItem",
  component: NotificationListItem,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    )
  ]
};

export default meta;

type IStory = StoryObj<typeof NotificationListItem>;

const base = {
  id: "n1",
  eventType: "comment.replied",
  title: "Alice replied to your comment",
  body: "Sounds good — let's revisit Tuesday.",
  ctaUrl: null,
  ctaLabel: null,
  status: "unread" as const,
  readAt: null,
  createdAt: now()
};

export const Default: IStory = {
  args: { notification: base }
};

export const Read: IStory = {
  args: { notification: { ...base, status: "read" } }
};

export const WithCta: IStory = {
  args: {
    notification: {
      ...base,
      ctaUrl: "/comments/123",
      ctaLabel: "View reply"
    }
  }
};

export const Archived: IStory = {
  args: { notification: { ...base, status: "archived" } }
};
