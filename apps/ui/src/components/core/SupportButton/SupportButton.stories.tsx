import type { Meta, StoryObj } from "@storybook/react-vite";

import { SupportButton } from "./SupportButton";

const meta: Meta<typeof SupportButton> = {
  title: "Core/SupportButton",
  component: SupportButton,
  args: { onOpen: () => undefined }
};

export default meta;

type IStory = StoryObj<typeof SupportButton>;

export const Default: IStory = {};
