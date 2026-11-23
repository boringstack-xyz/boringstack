import type { Meta, StoryObj } from "@storybook/react-vite";
import { HelmetProvider } from "react-helmet-async";

import { StatusPage } from "./StatusPage";

const meta: Meta<typeof StatusPage> = {
  title: "Core/StatusPage",
  component: StatusPage,
  decorators: [
    (Story) => (
      <HelmetProvider>
        <Story />
      </HelmetProvider>
    )
  ],
  args: {
    metaTitle: "Link expired",
    kind: "missing",
    eyebrow: "Link expired",
    title: "This link has expired",
    body: "Ask the person who invited you to send a new one.",
    action: { label: "Back to sign in", to: "/login" }
  }
};

export default meta;

type IStory = StoryObj<typeof StatusPage>;

export const Default: IStory = {};

export const Offline: IStory = {
  args: {
    metaTitle: "Offline",
    kind: "offline",
    title: "Can't reach the server",
    body: "Check your connection and try again.",
    action: { label: "Try again", onClick: () => undefined }
  }
};
