import type { Meta, StoryObj } from "@storybook/react-vite";

import AppShellPageHeader from "./AppShellPageHeader";

const meta: Meta<typeof AppShellPageHeader> = {
  title: "Core/AppShellPageHeader",
  component: AppShellPageHeader,
  args: {
    title: "Projects",
    eyebrow: "Workspace",
    subtitle: "Everything you are working on."
  }
};

export default meta;

type IStory = StoryObj<typeof AppShellPageHeader>;

export const Default: IStory = {};

export const TitleOnly: IStory = {
  args: { eyebrow: undefined, subtitle: undefined }
};
