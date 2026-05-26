import type { Meta, StoryObj } from "@storybook/react-vite";

import Tokens from "./Tokens";

const meta: Meta<typeof Tokens> = {
  title: "Foundations/Tokens",
  component: Tokens,
  parameters: { layout: "fullscreen" }
};

export default meta;

type IStory = StoryObj<typeof Tokens>;

export const Default: IStory = {};
