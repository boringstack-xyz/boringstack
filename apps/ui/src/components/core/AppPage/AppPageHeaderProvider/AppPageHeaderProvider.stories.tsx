import type { Meta, StoryObj } from "@storybook/react-vite";

import AppPageHeaderProvider from "./AppPageHeaderProvider";

const meta: Meta<typeof AppPageHeaderProvider> = {
  title: "Components/core/AppPageHeaderProvider",
  component: AppPageHeaderProvider
};

export default meta;

type IStory = StoryObj<typeof AppPageHeaderProvider>;

export const Default: IStory = {
  args: {
    children: "Provider children"
  }
};
