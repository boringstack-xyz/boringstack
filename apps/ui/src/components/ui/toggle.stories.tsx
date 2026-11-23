import type { Meta, StoryObj } from "@storybook/react-vite";

import { Toggle } from "./toggle";

const meta: Meta<typeof Toggle> = {
  title: "UI/Toggle",
  component: Toggle,
  args: { "aria-label": "Bold", children: "Bold" }
};

export default meta;

type IStory = StoryObj<typeof Toggle>;

export const Default: IStory = {};

export const Outline: IStory = {
  args: { variant: "outline" }
};

export const Pressed: IStory = {
  args: { defaultPressed: true }
};
