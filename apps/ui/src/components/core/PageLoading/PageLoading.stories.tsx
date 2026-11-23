import type { Meta, StoryObj } from "@storybook/react-vite";

import PageLoading from "./PageLoading";

const meta: Meta<typeof PageLoading> = {
  title: "Core/PageLoading",
  component: PageLoading,
  args: { title: "Opening your project", fullScreen: false }
};

export default meta;

type IStory = StoryObj<typeof PageLoading>;

export const Default: IStory = {};

export const FullScreen: IStory = {
  args: { fullScreen: true }
};
