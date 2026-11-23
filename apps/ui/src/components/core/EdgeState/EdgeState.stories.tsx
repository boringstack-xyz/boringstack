import type { Meta, StoryObj } from "@storybook/react-vite";

import { EdgeState } from "./EdgeState";

const meta: Meta<typeof EdgeState> = {
  title: "Core/EdgeState",
  component: EdgeState,
  args: {
    kind: "empty",
    title: "Nothing here yet",
    body: "Add your first item and it will show up in this list.",
    action: { label: "Add an item", onClick: () => undefined }
  }
};

export default meta;

type IStory = StoryObj<typeof EdgeState>;

export const Default: IStory = {};

export const Missing: IStory = {
  args: {
    kind: "missing",
    eyebrow: "404",
    title: "This page doesn't exist",
    body: "The link may be old, or the page may have moved.",
    action: { label: "Back to the dashboard", to: "/dashboard" }
  }
};

export const Offline: IStory = {
  args: {
    kind: "offline",
    title: "Can't reach the server",
    body: "Check your connection and try again.",
    action: { label: "Try again", onClick: () => undefined },
    secondaryAction: { label: "Get help", onClick: () => undefined }
  }
};

export const Failed: IStory = {
  args: {
    kind: "error",
    title: "Something went wrong",
    body: "We couldn't save your changes.",
    action: { label: "Try again", onClick: () => undefined }
  }
};

export const Loading: IStory = {
  args: {
    kind: "loading",
    title: "Working on it…",
    action: undefined
  }
};

export const Success: IStory = {
  args: {
    kind: "success",
    title: "All done",
    body: "Your changes are saved.",
    action: undefined
  }
};

export const Compact: IStory = {
  args: { size: "compact", kind: "error", title: "Couldn't load the chart" }
};
