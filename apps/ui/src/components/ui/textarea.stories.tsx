import type { Meta, StoryObj } from "@storybook/react-vite";

import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  args: {
    placeholder: "Tell us more",
    "aria-label": "Message",
    className: "w-96"
  }
};

export default meta;

type IStory = StoryObj<typeof Textarea>;

export const Default: IStory = {};

export const Invalid: IStory = {
  args: { "aria-invalid": true, defaultValue: "Too short" }
};

export const Disabled: IStory = {
  args: { disabled: true }
};
