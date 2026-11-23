import type { Meta, StoryObj } from "@storybook/react-vite";

import { Slider } from "./slider";

const meta: Meta<typeof Slider> = {
  title: "UI/Slider",
  component: Slider,
  args: {
    defaultValue: [40],
    max: 100,
    step: 1,
    "aria-label": "Volume",
    className: "w-64"
  }
};

export default meta;

type IStory = StoryObj<typeof Slider>;

export const Default: IStory = {};

export const Disabled: IStory = {
  args: { disabled: true }
};
