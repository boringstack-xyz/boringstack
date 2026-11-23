import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
  args: { "aria-label": "Accept the terms" }
};

export default meta;

type IStory = StoryObj<typeof Checkbox>;

export const Default: IStory = {};

export const Checked: IStory = {
  args: { defaultChecked: true }
};

export const Disabled: IStory = {
  args: { disabled: true }
};

export const Toggles: IStory = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole("checkbox");

    await userEvent.click(box);
    await expect(box).toBeChecked();
  }
};
