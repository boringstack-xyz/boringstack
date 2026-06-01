import type { Meta, StoryObj } from "@storybook/react-vite";

import ThemeToggle from "./ThemeToggle";

const meta: Meta<typeof ThemeToggle> = {
  title: "Components/core/ThemeToggle",
  component: ThemeToggle
};

export default meta;

type IStory = StoryObj<typeof ThemeToggle>;

export const Default: IStory = {};
